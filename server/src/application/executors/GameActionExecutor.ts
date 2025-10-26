import { GameAction, GameActionResult } from "domain/types/action/GameAction";
import { ILogger } from "infrastructure/logger/ILogger";
import { GameActionLockService } from "infrastructure/services/lock/GameActionLockService";
import { GameActionQueueService } from "infrastructure/services/queue/GameActionQueueService";

/**
 * Callback type for executing game actions
 */
export type GameActionExecutionCallback = (
  action: GameAction
) => Promise<GameActionResult>;

/**
 * Registry mapping action IDs to their execution callbacks
 * Each action gets its own callback to preserve socket context
 */
type ActionExecutionRegistry = Map<string, GameActionExecutionCallback>;

/**
 * Orchestrates game action execution with locking and queuing
 *
 * Flow:
 * 1. Action arrives → try acquire lock
 * 2. If locked → queue action with callback, return success (queued)
 * 3. If unlocked → execute immediately
 * 4. After execution → release lock, process queued actions recursively
 *
 * Key insight: Each action instance stores its own execution callback,
 * preserving the original socket/handler context for queued execution.
 */
export class GameActionExecutor {
  private readonly executionRegistry: ActionExecutionRegistry = new Map();

  constructor(
    private readonly queueService: GameActionQueueService,
    private readonly lockService: GameActionLockService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Execute action immediately if lock available, otherwise queue it
   * @param action The action to execute
   * @param executeFn Callback to execute the action (provided by handler)
   */
  public async submitAction(
    action: GameAction,
    executeFn: GameActionExecutionCallback
  ): Promise<GameActionResult> {
    // Register callback with action ID (not type!) to preserve socket context
    this.registerExecutionCallback(action.id, executeFn);

    const lockAcquired = await this.lockService.acquireLock(action.gameId);

    if (!lockAcquired) {
      await this.queueService.pushAction(action);
      this.logger.debug(
        `Action queued (game locked): ${action.type} for game ${action.gameId}`,
        {
          prefix: "[ACTION_EXECUTOR]: ",
          actionId: action.id,
          gameId: action.gameId,
        }
      );
      return { success: true };
    }

    try {
      const result = await this.executeAction(action, executeFn);
      // Clean up callback after successful immediate execution
      this.executionRegistry.delete(action.id);
      return result;
    } catch (error) {
      // Clean up callback on error too
      this.executionRegistry.delete(action.id);
      throw error;
    } finally {
      await this.lockService.releaseLock(action.gameId);
      await this.processQueuedActions(action.gameId);
    }
  }

  /**
   * Register execution callback for a specific action instance
   * Each action ID gets its own callback to preserve socket context
   */
  private registerExecutionCallback(
    actionId: string,
    callback: GameActionExecutionCallback
  ): void {
    this.executionRegistry.set(actionId, callback);
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: GameAction,
    executeFn: GameActionExecutionCallback
  ): Promise<GameActionResult> {
    try {
      const result = await executeFn(action);
      return result;
    } catch (error) {
      this.logger.error(`Action execution failed: ${action.type} - ${error}`, {
        prefix: "[ACTION_EXECUTOR]: ",
        actionId: action.id,
        gameId: action.gameId,
      });
      // Rethrow error to propagate to handler for proper error emission
      throw error;
    }
  }

  /**
   * Process all queued actions for a game sequentially
   * Called after releasing lock to drain the queue
   */
  private async processQueuedActions(gameId: string): Promise<void> {
    const queueLength = await this.queueService.getQueueLength(gameId);

    if (queueLength === 0) {
      return;
    }

    this.logger.debug(
      `Processing ${queueLength} queued actions for game ${gameId}`,
      {
        prefix: "[ACTION_EXECUTOR]: ",
        gameId,
        queueLength,
      }
    );

    // Process next queued action if lock can be acquired
    const lockAcquired = await this.lockService.acquireLock(gameId);

    if (!lockAcquired) {
      this.logger.debug(
        `Cannot process queue for game ${gameId} - lock held by another operation`,
        {
          prefix: "[ACTION_EXECUTOR]: ",
          gameId,
        }
      );
      return;
    }

    let nextAction: GameAction | null = null;

    try {
      nextAction = await this.queueService.popAction(gameId);

      if (!nextAction) {
        this.logger.trace(`Queue empty for game ${gameId}`, {
          prefix: "[ACTION_EXECUTOR]: ",
          gameId,
        });
        return;
      }

      const executeFn = this.executionRegistry.get(nextAction.id);

      if (!executeFn) {
        this.logger.error(
          `No execution callback found for queued action (action may have timed out or been cleaned up)`,
          {
            prefix: "[ACTION_EXECUTOR]: ",
            gameId,
            actionType: nextAction.type,
            actionId: nextAction.id,
          }
        );
        return;
      }
      await this.executeAction(nextAction, executeFn);
    } catch (error) {
      this.logger.error(
        `Error processing queued action for game ${gameId}: ${error}`,
        {
          prefix: "[ACTION_EXECUTOR]: ",
          gameId,
        }
      );
    } finally {
      await this.lockService.releaseLock(gameId);
      // Clean up the callback after execution
      if (nextAction) {
        this.executionRegistry.delete(nextAction.id);
      }
      // Recursively process remaining queued actions
      await this.processQueuedActions(gameId);
    }
  }

  /**
   * Check if there are queued actions and process them
   * Should be called after releasing lock
   */
  public async hasQueuedActions(gameId: string): Promise<boolean> {
    return !(await this.queueService.isEmpty(gameId));
  }

  /**
   * Peek at next queued action without removing it
   */
  public async peekNextAction(gameId: string): Promise<GameAction | null> {
    return this.queueService.peekAction(gameId);
  }

  /**
   * Pop next queued action for execution
   */
  public async popNextAction(gameId: string): Promise<GameAction | null> {
    return this.queueService.popAction(gameId);
  }
}
