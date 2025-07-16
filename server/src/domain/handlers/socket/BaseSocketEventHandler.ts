import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { ErrorController } from "domain/errors/ErrorController";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { type ILogger } from "infrastructure/logger/ILogger";
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
  data?: T;
  error?: string;
  context?: SocketEventContext & {
    customData?: Record<string, unknown>;
  };
  broadcast?: SocketEventBroadcast<unknown>[];
}

export interface SocketEventBroadcast<T = unknown> {
  event: SocketIOEvents | SocketIOGameEvents;
  data: T;
  target?: SocketBroadcastTarget;
  gameId?: string;
  useRoleBasedBroadcast?: boolean;
}

/**
 * Abstract base class for all socket event handlers
 * Provides consistent structure, validation, error handling, and logging
 */
export abstract class BaseSocketEventHandler<TInput = any, TOutput = any> {
  protected readonly socket: Socket;
  protected readonly eventEmitter: SocketIOEventEmitter;
  protected readonly logger: ILogger;

  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger
  ) {
    this.socket = socket;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
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

      // Business logic execution
      const result = await this.execute(validatedData, context);

      // Post-execution hooks
      await this.afterHandle(result, context);

      // Handle broadcasting if specified
      if (result.broadcast) {
        await this.handleBroadcasts(result.broadcast);
      }

      await this.afterBroadcast(result, context);

      // Success logging
      this.logSuccess(context, Date.now() - startTime);
    } catch (error) {
      // Error handling
      await this.handleError(error, context, Date.now() - startTime);
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
   * Execute the main business logic
   * Must be implemented by subclasses
   */
  protected abstract execute(
    data: TInput,
    context: SocketEventContext
  ): Promise<SocketEventResult<TOutput>>;

  /**
   * Get the event name this handler processes
   * Must be implemented by subclasses
   */
  public abstract getEventName(): SocketIOEvents | SocketIOGameEvents;

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

      // Emit error to client
      this.eventEmitter.emit<ErrorEventPayload>(SocketIOEvents.ERROR, {
        message: message,
      });

      // Log error with full context and original error details for server-side debugging
      this.logger.error(
        `Socket event error in ${this.getEventName()}: ${message} | SocketId: ${
          context.socketId
        } | UserId: ${context.userId} | GameId: ${
          context.gameId
        } | Duration: ${duration}ms | OriginalError: ${String(error)}`,
        { prefix: "[SOCKET]: " }
      );
    } catch (handlingError) {
      this.logger.error(
        `Error while handling socket event error: ${handlingError} | OriginalError: ${String(
          error
        )} | SocketId: ${context.socketId}`,
        { prefix: "[SOCKET]: " }
      );
    }
  }

  /**
   * Log successful execution
   */
  private logSuccess(context: SocketEventContext, duration: number): void {
    const eventName = this.getEventName();
    this.logger.info(
      `Socket event ${eventName} completed successfully | SocketId: ${context.socketId} | UserId: ${context.userId} | GameId: ${context.gameId} | Duration: ${duration}ms`,
      { prefix: "[SOCKET]: " }
    );
  }
}
