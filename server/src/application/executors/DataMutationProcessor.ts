import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { GamePipelineService } from "application/services/pipeline/GamePipelineService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { type Game } from "domain/entities/game/Game";
import { DataMutationType } from "domain/enums/DataMutationType";
import { type SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  type BroadcastMutation,
  type DataMutation,
  type DeleteTimerMutation,
  type GameCompletionMutation,
  type SaveGameMutation,
  type SetTimerMutation,
  type UpdatePlayerStatsMutation,
  type UpdateSocketSessionMutation,
} from "domain/types/action/DataMutation";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

/**
 * Classified mutations grouped by type for ordered processing.
 * Produced by the switch-case classifier, consumed by pipeline builders.
 */
interface ClassifiedMutations {
  saveGame: SaveGameMutation | null;
  timerSets: SetTimerMutation[];
  timerDeletes: DeleteTimerMutation[];
  broadcasts: BroadcastMutation[];
  completions: GameCompletionMutation[];
  socketSessionUpdates: UpdateSocketSessionMutation[];
  playerStatsUpdates: UpdatePlayerStatsMutation[];
}

/**
 * Result of mutation processing — used by the executor for drain decisions.
 */
interface MutationProcessResult {
  queueLength: number;
}

/**
 * Processes {@link DataMutation} arrays returned by action handlers.
 *
 * This is the single place where handler-declared mutations are translated
 * into actual Redis I/O and socket broadcasts. Reading the switch-case in
 * {@link classifyMutations} tells you exactly what each mutation type does.
 *
 * Processing order:
 *   1. **Classify** — switch-case groups mutations by type
 *   2. **OUT pipeline** — SAVE_GAME + TIMER_SET + TIMER_DELETE batched in 1 RT
 *   3. **Socket session updates** — socket↔game association written to Redis
 *   4. **Player stats updates** — stats initialisation / leftAt clearance
 *   5. **Broadcasts** — emitted after all state is persisted (clients may
 *      query Redis immediately upon receiving a broadcast, so every write
 *      must be visible before the notification fires)
 *   6. **Game completion** — statistics persistence, cleanup (last)
 */
@singleton()
export class DataMutationProcessor {
  constructor(
    private readonly pipelineService: GamePipelineService,
    private readonly broadcastService: GameActionBroadcastService,
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Process all mutations from an action handler result.
   *
   * @param result - The handler result containing mutations
   * @param ctx - The action execution context (for game fallback, gameId)
   * @returns Queue length for the executor's drain decision
   */
  public async process(
    result: ActionHandlerResult,
    ctx: ActionExecutionContext<unknown>
  ): Promise<MutationProcessResult> {
    const classified = this.classifyMutations(result.mutations);

    const { queueLength } = await this.executePipeline(classified, ctx.game.id);

    await this.executeSocketSessionUpdates(classified.socketSessionUpdates);
    // TODO: Since player stats updates is DB action - should be done in async to not block websocket event flow
    await this.executePlayerStatsUpdates(classified.playerStatsUpdates);

    const broadcastGame = this.resolveBroadcastGame(
      result,
      classified,
      ctx.game
    );
    await this.emitBroadcasts(
      classified.broadcasts,
      broadcastGame,
      result.success
    );

    await this.executeCompletions(classified.completions);

    return { queueLength };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 1: Classify mutations via switch-case
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Classify mutations by type into processing groups.
   *
   * This switch-case is the single source of truth for what each
   * {@link DataMutationType} means at the processing layer:
   *
   * - **SAVE_GAME** → game entity queued for HSET (last one wins)
   * - **TIMER_SET** → `SET key value PX ttl` appended to pipeline
   * - **TIMER_DELETE** → `DEL key` appended to pipeline
   * - **BROADCAST** → socket event queued for emission after pipeline
   * - **GAME_COMPLETION** → lifecycle handler queued for post-broadcast execution
   */
  private classifyMutations(mutations: DataMutation[]): ClassifiedMutations {
    let saveGame: SaveGameMutation | null = null;
    const timerSets: SetTimerMutation[] = [];
    const timerDeletes: DeleteTimerMutation[] = [];
    const broadcasts: BroadcastMutation[] = [];
    const completions: GameCompletionMutation[] = [];
    const socketSessionUpdates: UpdateSocketSessionMutation[] = [];
    const playerStatsUpdates: UpdatePlayerStatsMutation[] = [];

    for (const mutation of mutations) {
      switch (mutation.type) {
        case DataMutationType.SAVE_GAME:
          // Last SAVE_GAME wins — handlers should only have one,
          // but if multiple exist the last state is the most complete
          saveGame = mutation;
          break;

        case DataMutationType.TIMER_SET:
          timerSets.push(mutation);
          break;

        case DataMutationType.TIMER_DELETE:
          timerDeletes.push(mutation);
          break;

        case DataMutationType.BROADCAST:
          broadcasts.push(mutation);
          break;

        case DataMutationType.GAME_COMPLETION:
          completions.push(mutation);
          break;

        case DataMutationType.UPDATE_SOCKET_SESSION:
          socketSessionUpdates.push(mutation);
          break;

        case DataMutationType.UPDATE_PLAYER_STATS:
          playerStatsUpdates.push(mutation);
          break;
      }
    }

    return {
      saveGame,
      timerSets,
      timerDeletes,
      broadcasts,
      completions,
      socketSessionUpdates,
      playerStatsUpdates,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 2: OUT pipeline (1 Redis RT)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Delegates to {@link GamePipelineService.executeOutPipeline}.
   * See that method for full documentation of pipeline commands.
   */
  private async executePipeline(
    classified: ClassifiedMutations,
    gameId: string
  ): Promise<{ queueLength: number }> {
    return this.pipelineService.executeOutPipeline(classified, gameId);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 3: Socket session updates
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Emit broadcasts from classified mutations.
   * Only emits when the handler result was successful.
   *
   * Broadcasts run AFTER all state writes (pipeline, session, stats) so that
   * clients querying Redis upon receiving a broadcast always see consistent data.
   */
  private async emitBroadcasts(
    broadcasts: BroadcastMutation[],
    game: Game,
    success: boolean
  ): Promise<void> {
    if (!success || broadcasts.length === 0) {
      return;
    }

    // Convert BroadcastMutation[] to SocketEventBroadcast[] for the broadcast service
    const socketBroadcasts: SocketEventBroadcast[] = broadcasts.map((b) => ({
      event: b.event,
      data: b.data,
      target: b.target,
      gameId: b.gameId,
      socketId: b.socketId,
      useRoleBasedBroadcast: b.useRoleBasedBroadcast,
    }));

    await this.broadcastService.emitBroadcasts(socketBroadcasts, game);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 4: Player stats updates
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Write socket↔game associations to Redis.
   *
   * These were previously hidden inside service methods (e.g. inside
   * `SocketIOGameService.joinPlayerToGame`). By declaring them as mutations
   * the execution is transparent and auditable.
   */
  private async executeSocketSessionUpdates(
    updates: UpdateSocketSessionMutation[]
  ): Promise<void> {
    for (const mutation of updates) {
      try {
        await this.socketUserDataService.update(mutation.socketId, {
          id: mutation.userId,
          gameId: mutation.gameId,
        });
      } catch (error) {
        // Session updates are best-effort: if they fail the game state is
        // still persisted. Log a warning but do not crash the action.
        this.logger.warn("Failed to update socket session", {
          prefix: LogPrefix.ACTION,
          socketId: mutation.socketId,
          gameId: mutation.gameId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 5: Broadcasts
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Apply player statistics side-effects declared by Use Cases.
   *
   * These were previously hidden inside service methods. By returning them as
   * mutations the Use Case stays pure and tests can assert exactly which
   * stats operations will occur for a given flow.
   */
  private async executePlayerStatsUpdates(
    updates: UpdatePlayerStatsMutation[]
  ): Promise<void> {
    for (const mutation of updates) {
      try {
        switch (mutation.payload.action) {
          case "INIT_SESSION":
            await this.playerGameStatsService.initializePlayerSession(
              mutation.gameId,
              mutation.userId,
              mutation.payload.joinedAt
            );
            break;

          case "CLEAR_LEFT_AT":
            await this.playerGameStatsService.clearPlayerLeftAtTime(
              mutation.gameId,
              mutation.userId
            );
            break;
        }
      } catch (error) {
        // Stats updates are best-effort: if they fail the game is still saved.
        this.logger.warn("Failed to apply player stats mutation", {
          prefix: LogPrefix.ACTION,
          gameId: mutation.gameId,
          userId: mutation.userId,
          action: mutation.payload.action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 6: Game completion
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Execute game completion handlers (statistics, cleanup).
   * Runs after broadcasts so clients receive events before server-side cleanup.
   */
  private async executeCompletions(
    completions: GameCompletionMutation[]
  ): Promise<void> {
    for (const completion of completions) {
      const result = await this.gameLifecycleService.handleGameCompletion(
        completion.gameId
      );

      if (!result.success) {
        this.logger.error("Failed to execute game completion", {
          prefix: LogPrefix.ACTION,
          gameId: completion.gameId,
          error: result.error,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Resolve which game entity to use for broadcast role filtering.
   *
   * Priority:
   *   1. result.broadcastGame (explicit override from handler)
   *   2. SAVE_GAME mutation's game (most up-to-date persisted state)
   *   3. ctx.game (original prefetched game — fallback)
   */
  private resolveBroadcastGame(
    result: ActionHandlerResult,
    classified: ClassifiedMutations,
    ctxGame: Game
  ): Game {
    if (result.broadcastGame) {
      return result.broadcastGame;
    }

    if (classified.saveGame) {
      return classified.saveGame.game;
    }

    return ctxGame;
  }
}
