import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { GamePipelineService } from "application/services/pipeline/GamePipelineService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { type Game } from "domain/entities/game/Game";
import { DataMutationType } from "domain/enums/DataMutationType";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  MutationAction,
  type BroadcastMutation,
  type DataMutation,
  type DeleteGameMutation,
  type DeleteTimerMutation,
  type DisconnectSocketMutation,
  type GameCompletionMutation,
  type SaveGameMutation,
  type SetTimerMutation,
  type UpdatePlayerStatsMutation,
  type UpdateSocketSessionMutation
} from "domain/types/action/DataMutation";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";

/**
 * Classified mutations grouped by type for ordered processing.
 * Produced by the switch-case classifier, consumed by pipeline builders.
 */
interface ClassifiedMutations {
  saveGame: SaveGameMutation | null;
  deleteGame: DeleteGameMutation | null;
  timerSets: SetTimerMutation[];
  timerDeletes: DeleteTimerMutation[];
  broadcasts: BroadcastMutation[];
  completions: GameCompletionMutation[];
  socketSessionUpdates: UpdateSocketSessionMutation[];
  playerStatsUpdates: UpdatePlayerStatsMutation[];
  disconnectSockets: DisconnectSocketMutation[];
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
 *   5. **Disconnect sockets** — forced disconnect side effects
 *   6. **Game completion** — statistics persistence, cleanup
 *   7. **Broadcasts** — emitted after all state is persisted (clients may
 *      query Redis immediately upon receiving a broadcast, so every write
 *      must be visible before the notification fires)
 */
@singleton()
export class DataMutationProcessor {
  constructor(
    private readonly pipelineService: GamePipelineService,
    private readonly broadcastService: GameActionBroadcastService,
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Process all mutations from an action handler result.
   *
   * @param result - The handler result containing mutations
   * @param ctx - The action execution context (for game fallback, gameId)
   */
  public async process(
    result: ActionHandlerResult,
    ctx: ActionExecutionContext<unknown>
  ): Promise<void> {
    const classified = this.classifyMutations(result.mutations);

    await this.executePipeline(classified, ctx.game.id);

    await this.executeSocketSessionUpdates(classified.socketSessionUpdates);
    // TODO: Since player stats updates is DB action - should be done in async to not block websocket event flow
    await this.executePlayerStatsUpdates(classified.playerStatsUpdates);
    await this.executeDisconnectSockets(classified.disconnectSockets);

    await this.executeCompletions(classified.completions);

    const broadcastGame = this.resolveBroadcastGame(result, classified, ctx.game);
    await this.emitBroadcasts(classified.broadcasts, broadcastGame, result.success);
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
   * - **GAME_COMPLETION** → lifecycle handler queued before finish broadcasts
   */
  private classifyMutations(mutations: DataMutation[]): ClassifiedMutations {
    let saveGame: SaveGameMutation | null = null;
    let deleteGame: DeleteGameMutation | null = null;
    const timerSets: SetTimerMutation[] = [];
    const timerDeletes: DeleteTimerMutation[] = [];
    const broadcasts: BroadcastMutation[] = [];
    const completions: GameCompletionMutation[] = [];
    const socketSessionUpdates: UpdateSocketSessionMutation[] = [];
    const playerStatsUpdates: UpdatePlayerStatsMutation[] = [];
    const disconnectSockets: DisconnectSocketMutation[] = [];

    for (const mutation of mutations) {
      switch (mutation.type) {
        case DataMutationType.SAVE_GAME:
          // Last SAVE_GAME wins — handlers should only have one,
          // but if multiple exist the last state is the most complete
          saveGame = mutation;
          break;

        case DataMutationType.DELETE_GAME:
          deleteGame = mutation;
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

        case DataMutationType.DISCONNECT_SOCKET:
          disconnectSockets.push(mutation);
          break;
      }
    }

    return {
      saveGame,
      deleteGame,
      timerSets,
      timerDeletes,
      broadcasts,
      completions,
      socketSessionUpdates,
      playerStatsUpdates,
      disconnectSockets
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 2: OUT pipeline (1 Redis RT)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Delegates to {@link GamePipelineService.executeOutPipeline}.
   * See that method for full documentation of pipeline commands.
   */
  private async executePipeline(classified: ClassifiedMutations, gameId: string): Promise<void> {
    return this.pipelineService.executeOutPipeline(classified, gameId);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 7: Broadcasts
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Emit broadcasts from classified mutations.
   * Only emits when the handler result was successful.
   *
   * Broadcasts run AFTER all state writes and completion handling so that
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

    await this.broadcastService.emitBroadcasts(
      DataMutationConverter.broadcastsToSocketEvents(broadcasts),
      game
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 3: Socket session updates
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Write socket↔game associations to Redis.
   *
   * These were previously hidden inside service methods (e.g. inside
   * `SocketIOGameService.joinPlayerToGame`). By declaring them as mutations
   * the execution is transparent and auditable.
   */
  private async executeSocketSessionUpdates(updates: UpdateSocketSessionMutation[]): Promise<void> {
    for (const mutation of updates) {
      try {
        await this.socketUserDataService.update(mutation.socketId, {
          id: mutation.userId,
          gameId: mutation.gameId
        });
      } catch (error) {
        // Session updates are best-effort: if they fail the game state is
        // still persisted. Log a warning but do not crash the action.
        this.logger.warn("Failed to update socket session", {
          prefix: LogPrefix.ACTION,
          socketId: mutation.socketId,
          gameId: mutation.gameId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 4: Player stats updates
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Apply player statistics side-effects declared by Use Cases.
   *
   * These were previously hidden inside service methods. By returning them as
   * mutations the Use Case stays pure and tests can assert exactly which
   * stats operations will occur for a given flow.
   */
  private async executePlayerStatsUpdates(updates: UpdatePlayerStatsMutation[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    for (const mutation of updates) {
      try {
        switch (mutation.payload.action) {
          case MutationAction.INIT_SESSION:
            await this.playerGameStatsService.initializePlayerSession(
              mutation.gameId,
              mutation.userId,
              mutation.payload.joinedAt
            );
            break;

          case MutationAction.CLEAR_LEFT_AT:
            await this.playerGameStatsService.clearPlayerLeftAtTime(
              mutation.gameId,
              mutation.userId
            );
            break;

          case MutationAction.END_SESSION:
            await this.playerGameStatsService.endPlayerSession(
              mutation.gameId,
              mutation.userId,
              mutation.payload.leftAt
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
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 5: Disconnect sockets
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Force disconnect sockets for banned/kicked users.
   */
  private async executeDisconnectSockets(mutations: DisconnectSocketMutation[]): Promise<void> {
    if (mutations.length === 0) {
      return;
    }

    for (const mutation of mutations) {
      try {
        const socketId = await this.socketUserDataService.findSocketIdByUserId(mutation.userId);
        if (socketId) {
          // Clear the session BEFORE disconnecting so the disconnect event
          // handler sees gameId=null and returns early — preventing a spurious
          // DISCONNECT action from being queued and competing for the game lock.
          await this.socketUserDataService.update(socketId, {
            id: JSON.stringify(mutation.userId),
            gameId: JSON.stringify(null)
          });
          this.realtimeGateway.disconnectSocket(socketId);
          this.logger.info(`Forced disconnect for user ${mutation.userId}`, {
            prefix: LogPrefix.ACTION,
            userId: mutation.userId,
            socketId
          });
        }
      } catch (error) {
        this.logger.warn("Failed to disconnect socket", {
          prefix: LogPrefix.ACTION,
          userId: mutation.userId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Step 6: Game completion
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Execute game completion handlers (statistics, cleanup).
   * Runs before broadcasts so GAME_FINISHED is emitted after persistence was attempted.
   */
  private async executeCompletions(completions: GameCompletionMutation[]): Promise<void> {
    for (const completion of completions) {
      const result = await this.gameLifecycleService.handleGameCompletion(completion.gameId);

      if (!result.success) {
        this.logger.error("Failed to execute game completion", {
          prefix: LogPrefix.ACTION,
          gameId: completion.gameId,
          error: result.error
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
