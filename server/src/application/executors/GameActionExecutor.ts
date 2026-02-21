import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { DataMutationProcessor } from "application/executors/DataMutationProcessor";
import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import {
  GamePipelineService,
  PIPELINE_LOCK_TTL_SECONDS,
  type PipelineInResult,
  type PipelineInSuccess,
} from "application/services/pipeline/GamePipelineService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import {
  gameKey,
  lockKey,
  queueKey,
  timerKey,
} from "domain/constants/redisKeys";
import { type Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { ErrorController } from "domain/errors/ErrorController";
import { GameMapper } from "domain/mappers/GameMapper";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  type GameAction,
  GameActionResult,
} from "domain/types/action/GameAction";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { asUserId } from "domain/types/ids";
import { type SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogContextService } from "infrastructure/logger/LogContext";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogTag } from "infrastructure/logger/LogTag";
import { GameActionLockService } from "infrastructure/services/lock/GameActionLockService";
import { GameActionQueueService } from "infrastructure/services/queue/GameActionQueueService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/** Safety cap on drain iterations. Remaining items are picked up by the next submitAction. */
const MAX_DRAIN_ITERATIONS = 100;

/**
 * Orchestrates game action execution with locking and queuing.
 *
 * All actions must have a registered handler in GameActionHandlerRegistry.
 * Handlers are stateless and distributed-safe (any server instance can execute any action).
 *
 * Every handler receives an {@link ActionExecutionContext} with prefetched game,
 * player, and timer data (loaded in the IN pipeline — 1 Redis RT), and returns
 * an {@link ActionHandlerResult} with `mutations: DataMutation[]` declaring all
 * side effects. The {@link DataMutationProcessor} processes these mutations
 * via switch-case (Redis pipeline, broadcasts, game completion).
 *
 * Flow:
 * 1. Action arrives → IN pipeline: try acquire lock + prefetch game/timer (1 RT)
 * 2. If locked → queue action in Redis (1 RT), return success (queued)
 * 3. If unlocked → execute handler with prefetched context (pure, 0 RT)
 * 4. After execution → DataMutationProcessor: save game + timer mutations + broadcasts + completions (1 RT + broadcasts)
 * 5. If queue non-empty → drain loop using atomic Lua script per iteration
 */
@singleton()
export class GameActionExecutor {
  constructor(
    private readonly handlerRegistry: GameActionHandlerRegistry,
    private readonly broadcastService: GameActionBroadcastService,
    private readonly queueService: GameActionQueueService,
    private readonly lockService: GameActionLockService,
    private readonly mutationProcessor: DataMutationProcessor,
    private readonly pipelineService: GamePipelineService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
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

      this.logger.warn(error, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
      });

      return { success: false, error };
    }

    const handler = this.handlerRegistry.get(action.type)!;

    this.logger.debug(`Action submitted`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type,
      gameId: action.gameId,
    });

    // ── IN pipeline: lock + speculative prefetch in 1 RT ──
    const inResult = await this.executePipelineIn(
      action.gameId,
      action.socketId
    );

    if (!inResult.lockAcquired) {
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
      const ctx = this.buildContext(action, inResult);
      const result = await this.executeAction(handler, ctx);
      const { queueLength } = await this.mutationProcessor.process(result, ctx);

      // Drain or release
      if (queueLength > 0) {
        await this.drainQueue(action.gameId, inResult.lockToken);
      } else {
        await this.lockService.releaseLock(action.gameId, inResult.lockToken);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      await this.lockService.releaseLock(action.gameId, inResult.lockToken);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  IN Pipeline
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Delegates to {@link GamePipelineService.executePipelineIn}.
   * See that method for full documentation.
   */
  private async executePipelineIn(
    gameId: string,
    socketId: string
  ): Promise<PipelineInResult> {
    return this.pipelineService.executePipelineIn(gameId, socketId);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Context building
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Build an ActionExecutionContext from an action and parsed IN pipeline data.
   */
  private buildContext(
    action: GameAction,
    inResult: PipelineInSuccess
  ): ActionExecutionContext<unknown> {
    const currentPlayer = inResult.game.getPlayer(action.playerId, {
      fetchDisconnected: false,
    });

    return {
      action,
      game: inResult.game,
      currentPlayer,
      timer: inResult.timer,
      lockToken: inResult.lockToken,
      userData: inResult.userData,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Action execution
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Execute a handler with prefetched context. Returns the ActionHandlerResult
   * which the caller passes to DataMutationProcessor.process().
   */
  private async executeAction(
    handler: GameActionHandler,
    ctx: ActionExecutionContext<unknown>
  ): Promise<ActionHandlerResult> {
    const startTime = Date.now();
    const { action } = ctx;

    try {
      const result = await handler.execute(ctx);

      const durationMs = Date.now() - startTime;

      this.logger.debug(`Action executed`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
        success: result.success,
        durationMs,
        mutationCount: result.mutations.length,
      });

      return result;
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

      return {
        success: false,
        error: message,
        mutations: [],
        broadcastGame: ctx.game,
      };
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Queue draining
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Process a single drained action: deserialize, validate, look up handler,
   * build context, execute, process mutations.
   *
   * @returns true if execution succeeded and draining should continue,
   *          false if processing should stop (caller must release the lock).
   */
  private async executeDrainedAction(
    rawAction: string,
    gameHash: Record<string, string>,
    sessionHash: Record<string, string>,
    rawTimer: string | null,
    lockToken: string,
    gameId: string
  ): Promise<boolean> {
    const action = this.deserializeAction(rawAction);

    if (!action) {
      this.logger.warn(`Failed to deserialize queued action`, {
        prefix: LogPrefix.ACTION,
        gameId,
      });
      return false;
    }

    this.logger.debug(`Draining queued action`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type,
      gameId,
    });

    const game = this.parseGameHash(gameHash);

    if (!game) {
      this.logger.warn(`Game not found for drained action`, {
        prefix: LogPrefix.ACTION,
        gameId,
      });
      return false;
    }

    const timer = GameActionExecutor.parseTimer(rawTimer);

    const handler = this.handlerRegistry.get(action.type);

    if (!handler) {
      this.logger.error(
        `No handler registered for drained action type: ${action.type}`,
        {
          prefix: LogPrefix.ACTION,
          actionId: action.id,
          actionType: action.type,
          gameId,
        }
      );
      return false;
    }

    const userData: SocketRedisUserData | null =
      sessionHash && !ValueUtils.isEmpty(sessionHash)
        ? {
            id: asUserId(parseInt(sessionHash.id, 10)),
            gameId:
              sessionHash.gameId === "null" || !sessionHash.gameId
                ? null
                : sessionHash.gameId,
          }
        : null;

    const ctx = this.buildContext(action, {
      lockAcquired: true,
      lockToken,
      game,
      timer,
      userData,
    });

    const result = await this.executeAction(handler, ctx);
    await this.mutationProcessor.process(result, ctx);

    return true;
  }

  /**
   * Drain all queued actions for a game using the atomic Lua script.
   *
   * Each iteration atomically: verifies lock ownership → pops next action →
   * reacquires lock with new token → prefetches game state + timer.
   * This guarantees the lock is never "free" between iterations, preventing
   * external actions from breaking FIFO order.
   *
   * Bounded by {@link MAX_DRAIN_ITERATIONS} as a safety cap. If the queue
   * still has items after the cap, the lock is released and remaining items
   * are picked up by the next {@link submitAction} call.
   *
   * @param gameId The game to drain the queue for
   * @param currentToken The current lock token held by the caller
   */
  private async drainQueue(
    gameId: string,
    currentToken: string
  ): Promise<void> {
    const lKey = lockKey(gameId);
    const qKey = queueKey(gameId);
    const gKey = gameKey(gameId);
    const tKey = timerKey(gameId);

    for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
      const drainResult = await this.lockService.drainAndReacquire(
        lKey,
        qKey,
        gKey,
        tKey,
        currentToken,
        PIPELINE_LOCK_TTL_SECONDS,
        GAME_TTL_IN_SECONDS
      );

      if (drainResult.status === "lock-lost") {
        this.logger.warn(
          `Lock lost during queue drain — another holder took over`,
          {
            prefix: LogPrefix.ACTION,
            gameId,
          }
        );
        return;
      }

      if (drainResult.status === "queue-empty") {
        // Lock already released by the Lua script
        return;
      }

      // action-popped: parse and execute
      currentToken = drainResult.token;

      const success = await this.executeDrainedAction(
        drainResult.action,
        drainResult.gameHash,
        drainResult.sessionHash,
        drainResult.timer,
        currentToken,
        gameId
      );

      if (!success) {
        await this.lockService.releaseLock(gameId, currentToken);
        return;
      }
    }

    // Safety cap reached — release lock so remaining items are picked up
    // by the next submitAction call
    this.logger.warn(
      `Drain loop hit safety cap (${MAX_DRAIN_ITERATIONS} iterations)`,
      {
        prefix: LogPrefix.ACTION,
        gameId,
      }
    );
    await this.lockService.releaseLock(gameId, currentToken);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Parsing helpers
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Deserialize a raw action JSON string from the queue.
   * Returns null if parsing fails.
   */
  private deserializeAction(raw: string): GameAction | null {
    try {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
        payload:
          typeof parsed.payload === "string"
            ? JSON.parse(parsed.payload)
            : parsed.payload,
      } as GameAction;
    } catch {
      return null;
    }
  }

  /**
   * Parse a raw game hash (Record<string, string>) into a Game entity.
   * Returns null if the hash is empty or validation fails.
   */
  private parseGameHash(rawHash: Record<string, string>): Game | null {
    if (!rawHash || ValueUtils.isEmpty(rawHash)) {
      return null;
    }

    try {
      const validatedData = GameRedisValidator.validateRedisData(rawHash);
      return GameMapper.deserializeGameHash(validatedData);
    } catch {
      return null;
    }
  }

  /**
   * Parse a raw timer JSON string into a GameStateTimerDTO.
   * Returns null if the string is empty/null or parsing fails.
   */
  private static parseTimer(raw: string | null): GameStateTimerDTO | null {
    if (!raw || ValueUtils.isEmpty(raw)) {
      return null;
    }

    try {
      // TODO: Use Joi schema
      return JSON.parse(raw) as GameStateTimerDTO;
    } catch {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Public helpers
  // ════════════════════════════════════════════════════════════════════════

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
