import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameActionType } from "domain/enums/GameActionType";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { GameAction } from "domain/types/action/GameAction";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { type ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { Socket } from "socket.io";

/**
 * Context information available to all socket event handlers
 */
export interface SocketEventContext {
  socketId: string;
  userId?: number;
  gameId?: string;
  startTime: number;
}

export enum SocketBroadcastTarget {
  SOCKET = "socket",
  GAME = "game",
  ALL = "all",
}

/**
 * Result of event handler execution
 */
export interface SocketEventResult<T = unknown> {
  success: boolean;
  /** Data that can be transferred between execution layers, e.g. from execute to afterBroadcast */
  data?: T;
  error?: string;
  context?: SocketEventContext & {
    customData?: Record<string, unknown>;
  };
  broadcast?: SocketEventBroadcast<unknown>[];
}

export interface SocketEventBroadcast<T = unknown> {
  event: SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;
  data: T;
  target?: SocketBroadcastTarget;
  gameId?: string;
  socketId?: string;
  useRoleBasedBroadcast?: boolean;
}

/**
 * Abstract base class for all socket event handlers
 * Provides consistent structure, validation, error handling, and logging
 *
 * All game-related handlers MUST use the action queue system via registered action handlers.
 * Only non-game actions (e.g., chat messages) may bypass the queue by implementing execute().
 */
export abstract class BaseSocketEventHandler<TInput = any, TOutput = any> {
  protected readonly socket: Socket;
  protected readonly eventEmitter: SocketIOEventEmitter;
  protected readonly logger: ILogger;
  protected readonly actionExecutor: GameActionExecutor;

  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor
  ) {
    this.socket = socket;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.actionExecutor = actionExecutor;
  }

  /**
   * Main entry point for handling socket events
   * Implements the template method pattern with hooks for subclasses
   */
  public async handle(data: TInput): Promise<void> {
    const context = this.createContext();
    const startTime = Date.now();

    try {
      // Pre-execution hooks
      await this.beforeHandle(data, context);

      // Input validation
      const validatedData = await this.validateInput(data);

      // Authorization check
      await this.authorize(validatedData, context);

      // Check if this action should use the action queue system
      const gameId = await this.getGameIdForAction(validatedData, context);
      const hasRegisteredHandler = gameId && this.hasRegisteredHandler();

      if (hasRegisteredHandler) {
        // Use action executor with locking and queuing
        await this.handleWithActionQueue(
          validatedData,
          context,
          gameId,
          startTime
        );
      } else if (this.canExecuteDirectly()) {
        // Only handlers that explicitly implement execute() can bypass the queue
        await this.executeDirectly(validatedData, context, startTime);
      } else if (!gameId && this.allowsNullGameId()) {
        // Handler explicitly allows null gameId - silently succeed (no-op)
        this.logSuccess(context, Date.now() - startTime);
      } else {
        // No registered action handler and no direct execute - this is a configuration error
        throw new Error(
          `No registered action handler for ${this.constructor.name}. ` +
            `All game actions must have a registered handler in ActionHandlerConfig.`
        );
      }
    } catch (error) {
      // Error handling
      await this.handleError(error, context, Date.now() - startTime);
    }
  }

  /**
   * Handle game action with locking and queuing.
   * Action must have a registered handler in GameActionHandlerRegistry.
   */
  private async handleWithActionQueue(
    data: TInput,
    context: SocketEventContext,
    gameId: string,
    startTime: number
  ): Promise<void> {
    const action: GameAction = {
      id: ValueUtils.generateUUID(),
      type: this.getActionType(),
      gameId: gameId,
      playerId: this.socket.userId ?? 0,
      socketId: this.socket.id,
      timestamp: new Date(),
      payload: data,
    };

    const result = await this.actionExecutor.submitAction(action);

    // If action was executed (not just queued), call afterHandle with result
    if (result.data !== undefined) {
      const socketResult: SocketEventResult<TOutput> = {
        success: result.success,
        data: result.data as TOutput,
        error: result.error,
        context: {
          ...context,
          gameId,
        },
      };
      await this.afterHandle(socketResult, context);
      await this.afterBroadcast(socketResult, context);
    }

    this.logSuccess(context, Date.now() - startTime);
  }

  /**
   * Execute action directly without locking.
   * ONLY for non-game actions like chat messages that don't need synchronization.
   * Game actions MUST use the action queue system.
   */
  private async executeDirectly(
    data: TInput,
    context: SocketEventContext,
    startTime: number
  ): Promise<void> {
    const result = await this.execute(data, context);

    await this.afterHandle(result, context);

    if (result.broadcast) {
      await this.handleBroadcasts(result.broadcast);
    }

    await this.afterBroadcast(result, context);

    const duration = Date.now() - startTime;

    if (result.success) {
      this.logSuccess(context, duration);
    } else {
      this.logUnsuccessful(context, duration);
    }
  }

  /**
   * Check if this handler can execute directly (bypassing action queue).
   * Returns true only if the handler has overridden the execute() method.
   */
  private canExecuteDirectly(): boolean {
    // Check if execute is overridden (not the base class implementation)
    return this.execute !== BaseSocketEventHandler.prototype.execute;
  }

  /**
   * Get game ID for action queue determination
   * Return null to execute without queue system
   * Override in subclasses for efficient retrieval
   */
  protected async getGameIdForAction(
    _data: TInput,
    _context: SocketEventContext
  ): Promise<string | null> {
    return null;
  }

  /**
   * Whether this handler allows null gameId without error.
   * When true and gameId is null, the handler will silently succeed (no-op).
   * Override to return true for handlers like disconnect that may be called
   * when the user isn't in a game.
   */
  protected allowsNullGameId(): boolean {
    return false;
  }

  /**
   * Get action type string for queue tracking
   * Override in subclasses that use action queue
   */
  protected getActionType(): GameActionType {
    throw new Error(
      `getActionType() must be overridden in ${this.constructor.name} when using action queue`
    );
  }

  /**
   * Check if this handler has a registered action handler in the executor.
   * Returns false if getActionType() is not overridden or handler not registered.
   */
  private hasRegisteredHandler(): boolean {
    try {
      const actionType = this.getActionType();
      return this.actionExecutor.hasHandler(actionType);
    } catch {
      return false;
    }
  }

  /**
   * Create context for this handler execution
   */
  protected createContext(): SocketEventContext {
    return {
      socketId: this.socket.id,
      startTime: Date.now(),
    };
  }

  /**
   * Hook called before main execution - override for preparation logic
   */
  protected async beforeHandle(
    _data: TInput,
    _context: SocketEventContext
  ): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Hook called after successful execution - override for cleanup/notifications
   */
  protected async afterHandle(
    _result: SocketEventResult<TOutput>,
    _context: SocketEventContext
  ): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Validate and transform input data
   * Must be implemented by subclasses
   */
  protected abstract validateInput(data: TInput): Promise<TInput>;

  /**
   * Check if the current user/socket is authorized for this action
   * Must be implemented by subclasses
   */
  protected abstract authorize(
    data: TInput,
    context: SocketEventContext
  ): Promise<void>;

  /**
   * Execute the main business logic directly (bypassing action queue).
   *
   * ⚠️ WARNING: This method bypasses the Redis lock and queue system!
   * Only implement this for non-game actions (e.g., chat messages) that:
   * - Don't need synchronization with other game actions
   * - Don't modify game state
   *
   * For game actions, register an action handler in ActionHandlerConfig instead.
   */
  protected async execute(
    _data: TInput,
    _context: SocketEventContext
  ): Promise<SocketEventResult<TOutput>> {
    throw new Error(
      `execute() not implemented in ${this.constructor.name}. ` +
        `Game actions must use the action queue system.`
    );
  }

  /**
   * Get the event name this handler processes
   * Must be implemented by subclasses
   */
  public abstract getEventName():
    | SocketIOEvents
    | SocketIOGameEvents
    | SocketIOUserEvents;

  /**
   * Handle broadcasting of events
   */
  private async handleBroadcasts(
    broadcasts: SocketEventBroadcast[]
  ): Promise<void> {
    if (!broadcasts || !broadcasts.length) return;

    for (const broadcast of broadcasts) {
      // Handle role-based broadcasts for game events
      if (
        broadcast.useRoleBasedBroadcast &&
        broadcast.target === SocketBroadcastTarget.GAME &&
        broadcast.gameId
      ) {
        await this.eventEmitter.emitWithRoleBasedFiltering(
          broadcast.event,
          broadcast.data as { gameState: GameStateDTO },
          broadcast.gameId
        );
        continue;
      }

      // Handle regular broadcasts
      switch (broadcast.target) {
        case SocketBroadcastTarget.SOCKET:
          this.eventEmitter.emit(broadcast.event, broadcast.data);
          break;
        case SocketBroadcastTarget.GAME:
          if (broadcast.gameId) {
            this.eventEmitter.emit(broadcast.event, broadcast.data, {
              emitter: SocketEventEmitter.IO,
              gameId: broadcast.gameId,
            });
          }
          break;
        case SocketBroadcastTarget.ALL:
        default:
          this.eventEmitter.emit(broadcast.event, broadcast.data, {
            emitter: SocketEventEmitter.IO,
          });
          break;
      }
    }
  }

  /**
   * Hook called after successful execution - override for cleanup/notifications
   */
  protected async afterBroadcast(
    _result: SocketEventResult<TOutput>,
    _context: SocketEventContext
  ): Promise<void> {
    // Default implementation - can be overridden
  }

  /**
   * Handle errors in a consistent way
   */
  private async handleError(
    error: unknown,
    context: SocketEventContext,
    duration: number
  ): Promise<void> {
    try {
      const { message } = await ErrorController.resolveError(
        error,
        this.logger
      );

      // Emit error to the socket that originated this action
      try {
        this.eventEmitter.emitToSocket<ErrorEventPayload>(
          SocketIOEvents.ERROR,
          { message: message },
          context.socketId
        );
      } catch {
        // Socket might have disconnected - this is expected, no log needed
      }

      // Only log if this adds context beyond what ErrorController already logged
      if (error instanceof ClientError) {
        // Client errors are expected - no logging needed
        return;
      }

      this.logger.error(`Socket event failed`, {
        prefix: "[SOCKET]: ",
        event: this.getEventName(),
        error: message,
        gameId: context.gameId,
        durationMs: duration,
      });
    } catch (handlingError) {
      this.logger.error(`Error while handling socket event error`, {
        prefix: "[SOCKET]: ",
        handlingError: String(handlingError),
        originalError: String(error),
      });
    }
  }

  /**
   * Log successful execution
   */
  private logSuccess(context: SocketEventContext, duration: number): void {
    this.logger.trace(`Socket event completed`, {
      prefix: "[SOCKET]: ",
      event: this.getEventName(),
      gameId: context.gameId,
      durationMs: duration,
    });
  }

  /**
   * Log unsuccessful execution
   */
  private logUnsuccessful(context: SocketEventContext, duration: number): void {
    this.logger.warn(`Socket event unsuccessful`, {
      prefix: "[SOCKET]: ",
      event: this.getEventName(),
      gameId: context.gameId,
      durationMs: duration,
    });
  }
}
