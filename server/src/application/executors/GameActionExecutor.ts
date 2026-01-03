import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { GameActionType } from "domain/enums/GameActionType";
import { ErrorController } from "domain/errors/ErrorController";
import { GameAction, GameActionResult } from "domain/types/action/GameAction";
import { GameActionHandlerResult } from "domain/types/action/GameActionHandler";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogContextService } from "infrastructure/logger/LogContext";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogTag } from "infrastructure/logger/LogTag";
import { GameActionLockService } from "infrastructure/services/lock/GameActionLockService";
import { GameActionQueueService } from "infrastructure/services/queue/GameActionQueueService";

/**
 * Orchestrates game action execution with locking and queuing.
 *
 * All actions must have a registered handler in GameActionHandlerRegistry.
 * Handlers are stateless and distributed-safe (any server instance can execute any action).
 *
 * Flow:
 * 1. Action arrives → try acquire lock
 * 2. If locked → queue action in Redis, return success (queued)
 * 3. If unlocked → execute immediately
 * 4. After execution → emit broadcasts, release lock, process queued actions
 */
export class GameActionExecutor {
  constructor(
    private readonly handlerRegistry: GameActionHandlerRegistry,
    private readonly broadcastService: GameActionBroadcastService,
    private readonly queueService: GameActionQueueService,
    private readonly lockService: GameActionLockService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Submit action for execution.
   * Action must have a registered handler in GameActionHandlerRegistry.
   *
   * @param action The action to execute
   * @returns Result indicating success/queued status
   */
  public async submitAction(action: GameAction): Promise<GameActionResult> {
    // Ensure log context has game and action tags
    LogContextService.setGameId(action.gameId);
    LogContextService.addTag(LogTag.QUEUE);

    if (!this.handlerRegistry.has(action.type)) {
      const error = `No handler registered for action type: ${action.type}`;

      this.logger.error(error, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
      });

      return { success: false, error };
    }

    this.logger.debug(`Action submitted`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type,
      gameId: action.gameId,
    });

    const lockAcquired = await this.lockService.acquireLock(action.gameId);

    if (!lockAcquired) {
      await this.queueService.pushAction(action);

      this.logger.debug(`Action queued (lock contention)`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
      });

      return { success: true };
    }

    try {
      return await this.executeAction(action);
    } finally {
      await this.lockService.releaseLock(action.gameId);
      await this.processQueuedActions(action.gameId);
    }
  }

  /**
   * Execute action via registered handler.
   */
  private async executeAction(action: GameAction): Promise<GameActionResult> {
    const handler = this.handlerRegistry.get(action.type)!;
    const startTime = Date.now();

    try {
      const result: GameActionHandlerResult = await handler.execute(action);

      if (result.success && result.broadcasts?.length) {
        await this.broadcastService.emitBroadcasts(
          result.broadcasts,
          result.broadcastGameId ?? action.gameId
        );
      }

      const durationMs = Date.now() - startTime;

      this.logger.debug(`Action executed`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
        success: result.success,
        durationMs,
        broadcastCount: result.broadcasts?.length ?? 0,
      });

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const { message } = await ErrorController.resolveError(
        error,
        this.logger,
        undefined,
        {
          source: "action-executor",
          actionId: action.id,
          actionType: action.type,
          gameId: action.gameId,
          durationMs,
        }
      );

      this.broadcastService.emitError(action.socketId, message);
      return { success: false, error: message };
    }
  }

  /**
   * Process all queued actions for a game sequentially.
   */
  private async processQueuedActions(gameId: string): Promise<void> {
    const queueLength = await this.queueService.getQueueLength(gameId);

    if (queueLength === 0) {
      return;
    }

    this.logger.debug(`Processing queued actions`, {
      prefix: LogPrefix.ACTION,
      gameId,
      queueLength,
    });

    const lockAcquired = await this.lockService.acquireLock(gameId);

    if (!lockAcquired) {
      this.logger.warn(
        `Cannot process queue - lock held by another operation`,
        {
          prefix: LogPrefix.ACTION,
          gameId,
        }
      );
      return;
    }

    let nextAction: GameAction | null = null;

    try {
      nextAction = await this.queueService.popAction(gameId);

      if (!nextAction) {
        return;
      }

      await this.executeAction(nextAction);
    } finally {
      await this.lockService.releaseLock(gameId);
      await this.processQueuedActions(gameId);
    }
  }

  /**
   * Check if there are queued actions.
   */
  public async hasQueuedActions(gameId: string): Promise<boolean> {
    return !(await this.queueService.isEmpty(gameId));
  }

  /**
   * Peek at next queued action without removing it.
   */
  public async peekNextAction(gameId: string): Promise<GameAction | null> {
    return this.queueService.peekAction(gameId);
  }

  /**
   * Check if a handler is registered for the given action type.
   */
  public hasHandler(actionType: GameActionType): boolean {
    return this.handlerRegistry.has(actionType);
  }
}
