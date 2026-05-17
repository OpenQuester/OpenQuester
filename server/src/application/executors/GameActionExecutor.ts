import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { DataMutationProcessor } from "application/executors/DataMutationProcessor";
import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import {
  GamePipelineService,
  PIPELINE_LOCK_TTL_SECONDS,
  type PipelineInSuccess,
  type PipelineReadResult
} from "application/services/pipeline/GamePipelineService";
import { SocketActionHooks } from "application/services/socket/SocketActionHooks";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { gameKey, lockKey, queueKey, timerKey } from "domain/constants/redisKeys";
import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { DataMutationType } from "domain/enums/DataMutationType";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type BroadcastMutation,
  type DataMutation
} from "domain/types/action/DataMutation";
import { type GameAction, type GameActionResult } from "domain/types/action/GameAction";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { ILogger } from "shared/logging/ILogger";
import { LogContextService } from "shared/logging/LogContext";
import { LogPrefix } from "shared/logging/LogPrefix";
import { LogTag } from "shared/logging/LogTag";
import {
  DrainStatus,
  GameActionLockService
} from "application/services/lock/GameActionLockService";
import { GameActionQueueService } from "application/services/queue/GameActionQueueService";

type DrainedActionResult =
  | {
      actionId: string;
      result: GameActionResult;
      stopDraining?: false;
    }
  | {
      stopDraining: true;
    };

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
 * 1. Action arrives → queue it before trying to become the processor.
 * 2. If lock acquisition fails → return success; current processor drains it.
 * 3. If lock acquisition succeeds → drain queued actions using atomic Lua.
 * 4. Each drained action fetches game/session/timer in the Lua drain step,
 *    executes its handler, persists mutations/broadcasts, then runs any
 *    post-execution socket hook before the next action is drained.
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
    private readonly socketActionHooks: SocketActionHooks,
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
    LogContextService.addTag(LogTag.ACTION);

    if (!this.handlerRegistry.has(action.type)) {
      const error = `No handler registered for action type: ${action.type}`;

      this.logger.warn(error, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId
      });

      return { success: false, error };
    }

    const queueResult = await this.queueService.queueActionAndTryStartProcessor(action);

    this.logger.debug(`Action submitted`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type,
      gameId: action.gameId
    });

    if (!queueResult.shouldProcessQueue) {
      this.logger.debug(`Action queued (lock contention)`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId
      });

      return { success: true };
    }

    const result = await this.drainQueue(action.gameId, queueResult.lockToken, action.id);

    if (!result) {
      return { success: true };
    }

    return result;
  }

  /**
   * Submit an action for direct execution, bypassing the lock/queue system.
   *
   * Used for actions that read game state for permission checks but never
   * mutate it (e.g. chat messages). Context is fully prefetched via the
   * read-only pipeline (same data as the normal IN pipeline, no lock).
   *
   * Only broadcast mutations are processed; game save / timer / queue
   * mutations are ignored.
   */
  public async submitDirectAction(action: GameAction): Promise<GameActionResult> {
    LogContextService.addTag(LogTag.ACTION);

    const handler = this.handlerRegistry.get(action.type);

    if (!handler) {
      const error = `No handler registered for action type: ${action.type}`;

      this.logger.warn(error, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type
      });

      return { success: false, error };
    }

    this.logger.debug(`Direct action submitted`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type
    });

    // Fetch real game/timer/userData context without acquiring a lock.
    // Direct execution handlers read state but never mutate it, so no
    // synchronization is needed.
    const readResult = await this.pipelineService.executePipelineReadOnly(
      action.gameId,
      action.socketId
    );

    const ctx = this.buildDirectContext(action, readResult);
    const result = await this.executeAction(handler, ctx);

    if (result.success) {
      await this.emitDirectBroadcasts(result.mutations, ctx.game);
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error
    };
  }

  /**
   * Extract and emit only BROADCAST mutations for direct execution.
   *
   * Direct execution bypasses the {@link DataMutationProcessor} pipeline
   * entirely — there's no game save, no timers, no queue to drain.
   * The real `game` is passed so {@link GameActionBroadcastService} can
   * use role-based filtering if needed (though chat broadcasts don't need it).
   */
  private async emitDirectBroadcasts(mutations: DataMutation[], game: Game): Promise<void> {
    const broadcastMutations = mutations.filter(
      (m): m is BroadcastMutation => m.type === DataMutationType.BROADCAST
    );

    if (broadcastMutations.length > 0) {
      await this.broadcastService.emitBroadcasts(
        DataMutationConverter.broadcastsToSocketEvents(broadcastMutations),
        game
      );
    }
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
      fetchDisconnected: false
    });

    return {
      action,
      game: inResult.game,
      currentPlayer,
      timer: inResult.timer,
      lockToken: inResult.lockToken,
      userData: inResult.userData
    };
  }

  /**
   * Build an ActionExecutionContext from an action and a read-only pipeline
   * result. Used by direct-execution actions — no lock is held, so
   * `lockToken` is empty.
   */
  private buildDirectContext(
    action: GameAction,
    readResult: PipelineReadResult
  ): ActionExecutionContext<unknown> {
    const currentPlayer = readResult.game.getPlayer(action.playerId, {
      fetchDisconnected: false
    });

    return {
      action,
      game: readResult.game,
      currentPlayer,
      timer: readResult.timer,
      lockToken: "",
      userData: readResult.userData
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
        mutationCount: result.mutations.length
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const { message } = await ErrorController.resolveError(error, this.logger, undefined, {
        source: "action-executor",
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
        durationMs
      });

      this.broadcastService.emitError(action.socketId, message);

      return {
        success: false,
        error: message,
        mutations: [],
        broadcastGame: ctx.game
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
   * @returns Result for the drained action, or null if the item should be
   * skipped and draining can continue.
   */
  private async executeDrainedAction(
    rawAction: string,
    gameHash: Record<string, string>,
    sessionHash: Record<string, string>,
    rawTimer: string | null,
    lockToken: string,
    gameId: string
  ): Promise<DrainedActionResult | null> {
    const action = this.deserializeAction(rawAction);

    if (!action) {
      this.logger.warn(`Failed to deserialize queued action`, {
        prefix: LogPrefix.ACTION,
        gameId
      });
      return null;
    }

    this.logger.debug(`Draining queued action`, {
      prefix: LogPrefix.ACTION,
      actionId: action.id,
      actionType: action.type,
      gameId
    });

    const game = GamePipelineService.parseGameHash(gameHash);

    if (!game) {
      this.logger.warn(`Game not found for drained action`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId
      });

      return {
        actionId: action.id,
        result: await this.emitActionError(
          action,
          new ClientError(ClientResponse.GAME_NOT_FOUND, HttpStatus.NOT_FOUND, {
            gameId: action.gameId
          }),
          "drained-action-game-not-found"
        )
      };
    }

    const timer = GamePipelineService.parseTimer(rawTimer);

    const handler = this.handlerRegistry.get(action.type);

    if (!handler) {
      this.logger.error(`No handler registered for drained action type: ${action.type}`, {
        prefix: LogPrefix.ACTION,
        actionId: action.id,
        actionType: action.type,
        gameId
      });

      return {
        actionId: action.id,
        result: await this.emitActionError(
          action,
          new ClientError(`No handler registered for action type: ${action.type}`),
          "drained-action-handler-not-found"
        )
      };
    }

    const userData = GamePipelineService.parseUserData(sessionHash);

    const ctx = this.buildContext(action, {
      lockAcquired: true,
      lockToken,
      game,
      timer,
      userData
    });

    const result = await this.executeAction(handler, ctx);
    await this.mutationProcessor.process(result, ctx);
    await this.socketActionHooks.run(
      action,
      {
        success: result.success,
        data: result.data,
        error: result.error
      },
      result.broadcastGame ?? ctx.game
    );

    return {
      actionId: action.id,
      result: {
        success: result.success,
        data: result.data,
        error: result.error
      }
    };
  }

  private async emitActionError(
    action: GameAction,
    error: unknown,
    source: string
  ): Promise<GameActionResult> {
    const { message } = await ErrorController.resolveError(error, this.logger, undefined, {
      source,
      actionId: action.id,
      actionType: action.type,
      gameId: action.gameId
    });

    this.broadcastService.emitError(action.socketId, message);

    return {
      success: false,
      error: message
    };
  }

  /**
   * Drain all queued actions for a game using the atomic Lua script.
   *
   * Each iteration atomically: verifies lock ownership → pops next action →
   * reacquires lock with new token → prefetches game state + timer.
   * This guarantees the lock is never "free" between iterations, preventing
   * external actions from breaking FIFO order.
   *
   * @param gameId The game to drain the queue for
   * @param currentToken The current lock token held by the caller
   * @param targetActionId Optional action whose result should be returned
   */
  private async drainQueue(
    gameId: string,
    currentToken: string,
    targetActionId?: string
  ): Promise<GameActionResult | null> {
    const lKey = lockKey(gameId);
    const qKey = queueKey(gameId);
    const gKey = gameKey(gameId);
    const tKey = timerKey(gameId);
    let targetResult: GameActionResult | null = null;

    while (currentToken) {
      const drainResult = await this.lockService.drainAndReacquire(
        lKey,
        qKey,
        gKey,
        tKey,
        currentToken,
        PIPELINE_LOCK_TTL_SECONDS,
        GAME_TTL_IN_SECONDS
      );

      switch (drainResult.status) {
        case DrainStatus.LOCK_LOST:
          this.logger.warn(`Lock lost during queue drain — another holder took over`, {
            prefix: LogPrefix.ACTION,
            gameId
          });
          return targetResult;

        case DrainStatus.QUEUE_EMPTY:
          // Lock already released by the Lua script
          return targetResult;

        case DrainStatus.ACTION_POPPED: {
          currentToken = drainResult.token;

          try {
            const drainedResult = await this.executeDrainedAction(
              drainResult.action,
              drainResult.gameHash,
              drainResult.sessionHash,
              drainResult.timer,
              currentToken,
              gameId
            );

            if (!drainedResult) {
              break;
            }

            if (drainedResult.stopDraining) {
              await this.lockService.releaseLock(gameId, currentToken);
              return targetResult;
            }

            if (drainedResult.actionId === targetActionId) {
              targetResult = drainedResult.result;
            }
          } catch (error) {
            await this.lockService.releaseLock(gameId, currentToken);
            throw error;
          }

          break;
        }
      }
    }

    return targetResult;
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
        payload: typeof parsed.payload === "string" ? JSON.parse(parsed.payload) : parsed.payload
      } as GameAction;
    } catch {
      return null;
    }
  }
}
