import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { GameAction } from "domain/types/action/GameAction";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogContextService } from "infrastructure/logger/LogContext";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogTag } from "infrastructure/logger/LogTag";
import { MetricsService } from "infrastructure/services/metrics/MetricsService";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { Socket } from "socket.io";
import { container } from "tsyringe";

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
  protected readonly metricsService: MetricsService;
  private readonly _socketUserDataService: SocketUserDataService;

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

    // TODO: Inject metricsService and socketUserDataService properly in constructor arguments
    this.metricsService = container.resolve(MetricsService);
    this._socketUserDataService = container.resolve(SocketUserDataService);
  }

  /**
   * Main entry point for handling socket events.
   * Implements the template method pattern with hooks for subclasses.
   */
  public async handle(data: TInput): Promise<void> {
    await this.resolveUserId();
    await this.withLogContext(async () => {
      const context = this.createContext();
      this.logEventReceived();

      try {
        const validatedData = await this.prepareExecution(data, context);
        const gameId = await this.resolveGameContext(validatedData, context);
        await this.routeAndExecute(validatedData, context, gameId);
        this.recordMetrics(context, "success");
      } catch (error) {
        this.recordMetrics(context, "error");
        await this.handleError(error, context);
      }
    });
  }

  /**
   * Record socket event metrics.
   */
  private recordMetrics(
    context: SocketEventContext,
    status: "success" | "error"
  ): void {
    const durationSeconds = (Date.now() - context.startTime) / 1000;
    const eventName = this.getEventName();

    this.metricsService.recordSocketEvent(
      {
        event: eventName,
        status,
      },
      durationSeconds
    );
  }

  /**
   * Ensures `socket.userId` is populated. In multi-instance deployments the
   * HTTP auth request may land on a different instance than the one owning the
   * WebSocket, so `socket.userId` is never set in-memory. This method lazily
   * resolves the userId from Redis (where the auth endpoint always persists it)
   * and caches it on the socket object for subsequent calls.
   */
  private async resolveUserId(): Promise<void> {
    if (this.socket.userId !== undefined) {
      return;
    }

    const data = await this._socketUserDataService.getSocketData(
      this.socket.id
    );

    if (data?.id) {
      this.socket.userId = data.id;
    }
  }

  /**
   * Wraps execution in log context for correlation ID tracking.
   */
  private async withLogContext(fn: () => Promise<void>): Promise<void> {
    const logContext = LogContextService.createContext({
      userId: this.socket.userId,
      socketId: this.socket.id,
      tags: new Set([LogTag.SOCKET]),
    });
    await LogContextService.runAsync(logContext, fn);
  }

  /**
   * Runs pre-execution hooks, validation, and authorization.
   */
  private async prepareExecution(
    data: TInput,
    context: SocketEventContext
  ): Promise<TInput> {
    await this.beforeHandle(data, context);
    const validatedData = await this.validateInput(data);
    await this.authorize(validatedData, context);
    return validatedData;
  }

  /**
   * Resolves game context and updates log tags if in a game.
   */
  private async resolveGameContext(
    data: TInput,
    context: SocketEventContext
  ): Promise<string | null> {
    const gameId = await this.getGameIdForAction(data, context);
    if (gameId) {
      LogContextService.setGameId(gameId);
      LogContextService.addTag(LogTag.GAME);
    }
    return gameId;
  }

  /**
   * Routes to the appropriate execution path based on handler configuration.
   */
  private async routeAndExecute(
    data: TInput,
    context: SocketEventContext,
    gameId: string | null
  ): Promise<void> {
    if (this.shouldUseActionQueue(gameId)) {
      return this.handleWithActionQueue(data, context, gameId!);
    }

    if (this.supportsDirectExecution()) {
      return this.executeDirectly(data, context);
    }

    if (!gameId && this.allowsNullGameId()) {
      return this.completeAsNoOp(context);
    }

    if (!gameId) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND);
    }

    if (this.isLifecycleRaceCondition()) {
      return this.handleLifecycleRaceCondition(gameId, context);
    }

    throw this.createMissingHandlerError();
  }

  private shouldUseActionQueue(gameId: string | null): gameId is string {
    return gameId !== null && this.hasRegisteredHandler();
  }

  private isLifecycleRaceCondition(): boolean {
    return this.hasActionType() && !this.hasRegisteredHandler();
  }

  private handleLifecycleRaceCondition(
    gameId: string,
    context: SocketEventContext
  ): void {
    this.logger.warn(
      `Action handler not registered for ${this.constructor.name} ` +
        `(type: ${this.getActionType()}). Possible server lifecycle race condition.`,
      {
        prefix: LogPrefix.SOCKET,
        event: this.getEventName(),
        gameId,
      }
    );
    this.logSuccess(context);
  }

  private createMissingHandlerError(): Error {
    return new Error(
      `No registered action handler for ${this.constructor.name}. ` +
        `All game actions must have a registered handler in ActionHandlerConfig.`
    );
  }

  // Completes successfully without doing anything (used when null gameId is allowed).
  private completeAsNoOp(context: SocketEventContext): void {
    this.logSuccess(context);
  }

  private logEventReceived(): void {
    this.logger.debug(`Socket event received: ${this.getEventName()}`, {
      prefix: LogPrefix.SOCKET,
      userId: this.socket.userId,
      socketId: this.socket.id,
    });
  }

  /**
   * Handle game action with locking and queuing.
   */
  private async handleWithActionQueue(
    data: TInput,
    context: SocketEventContext,
    gameId: string
  ): Promise<void> {
    const action = this.buildGameAction(data, gameId);
    const result = await this.actionExecutor.submitAction(action);

    if (result.data !== undefined) {
      await this.processActionResult(result, context, gameId);
    }

    this.logSuccess(context);
  }

  private buildGameAction(data: TInput, gameId: string): GameAction {
    return {
      id: ValueUtils.generateUUID(),
      type: this.getActionType(),
      gameId,
      playerId: this.socket.userId ?? -1,
      socketId: this.socket.id,
      timestamp: new Date(),
      payload: data,
    };
  }

  private async processActionResult(
    result: { success: boolean; data?: unknown; error?: string },
    context: SocketEventContext,
    gameId: string
  ): Promise<void> {
    const socketResult: SocketEventResult<TOutput> = {
      success: result.success,
      data: result.data as TOutput,
      error: result.error,
      context: { ...context, gameId },
    };
    await this.afterHandle(socketResult, context);
    await this.afterBroadcast(socketResult, context);
  }

  /**
   * Execute action directly without action queue (for non-game actions like chat).
   */
  private async executeDirectly(
    data: TInput,
    context: SocketEventContext
  ): Promise<void> {
    const result = await this.execute(data, context);

    await this.afterHandle(result, context);
    await this.broadcastIfNeeded(result.broadcast);
    await this.afterBroadcast(result, context);

    this.logExecutionResult(result.success, context);
  }

  private async broadcastIfNeeded(
    broadcasts: SocketEventBroadcast[] | undefined
  ): Promise<void> {
    if (broadcasts?.length) {
      await this.handleBroadcasts(broadcasts);
    }
  }

  private logExecutionResult(
    success: boolean,
    context: SocketEventContext
  ): void {
    if (success) {
      this.logSuccess(context);
    } else {
      this.logUnsuccessful(context);
    }
  }

  /**
   * Indicates whether this handler can execute directly, bypassing the action queue.
   *
   * Override and return `true` ONLY for handlers that:
   * - Do NOT affect game state (e.g., chat messages)
   * - Do NOT need synchronization with other game actions
   * - Do NOT require Redis locking
   *
   * ⚠️ WARNING: Returning true incorrectly can cause race conditions!
   * When in doubt, use the action queue system by registering a handler.
   *
   * @returns false by default - override in subclasses that need direct execution
   */
  protected supportsDirectExecution(): boolean {
    return false;
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
   * Check if this handler defines an action type (for diagnostics).
   * Different from hasRegisteredHandler() - this only checks if getActionType() is overridden.
   */
  private hasActionType(): boolean {
    try {
      this.getActionType();
      return true;
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
   * Handle errors in a consistent way.
   */
  private async handleError(
    error: unknown,
    context: SocketEventContext
  ): Promise<void> {
    const duration = this.calculateDuration(context);

    try {
      const { message } = await ErrorController.resolveError(
        error,
        this.logger,
        undefined,
        {
          source: "socket",
          event: this.getEventName(),
          gameId: context.gameId,
          userId: context.userId,
          durationMs: duration,
        }
      );

      this.emitErrorToClient(message, context.socketId);
    } catch (handlingError) {
      this.logger.error(`Error while handling socket event error`, {
        prefix: LogPrefix.SOCKET,
        handlingError: String(handlingError),
        originalError: String(error),
      });
    }
  }

  private emitErrorToClient(message: string, socketId: string): void {
    try {
      this.eventEmitter.emitToSocket<ErrorEventPayload>(
        SocketIOEvents.ERROR,
        { message },
        socketId
      );
    } catch {
      // Socket might have disconnected - expected, no log needed
    }
  }

  private calculateDuration(context: SocketEventContext): number {
    return Date.now() - context.startTime;
  }

  private logSuccess(context: SocketEventContext): void {
    this.logger.trace(`Socket event completed`, {
      prefix: LogPrefix.SOCKET,
      event: this.getEventName(),
      gameId: context.gameId,
      durationMs: this.calculateDuration(context),
    });
  }

  private logUnsuccessful(context: SocketEventContext): void {
    this.logger.debug(`Socket event unsuccessful`, {
      prefix: LogPrefix.SOCKET,
      event: this.getEventName(),
      gameId: context.gameId,
      durationMs: this.calculateDuration(context),
    });
  }
}
