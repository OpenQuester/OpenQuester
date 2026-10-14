import { inject, singleton } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { GameService } from "application/services/game/GameService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { SYSTEM_PLAYER_ID, SYSTEM_SOCKET_ID } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  type AdminGameDetailsData,
  type AdminGameListData,
  type AdminGameListQuery
} from "domain/types/admin/AdminTypes";
import { type GameAction } from "domain/types/action/GameAction";
import { type GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { GameEvent, type GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { ValueUtils } from "domain/utils/ValueUtils";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Game moderation for the admin panel: every game (private ones included)
 * and live actions on it. State changes go through {@link GameActionExecutor}
 * as moderation actions, so they queue behind in-flight player actions.
 */
@singleton()
export class AdminGameService {
  constructor(
    private readonly gameService: GameService,
    private readonly gameRepository: GameRepository,
    private readonly packageStore: PackageStore,
    private readonly actionExecutor: GameActionExecutor,
    private readonly socketUserDataService: SocketUserDataService,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async list(query: AdminGameListQuery): Promise<AdminGameListData> {
    return this.gameService.list({
      limit: query.limit,
      offset: query.offset,
      // The game index sorts by field name; the shared pagination type says Game
      sortBy: "createdAt" as unknown as GamePaginationOpts["sortBy"],
      order: PaginationOrder.DESC,
      ...(query.search ? { titlePrefix: query.search } : {})
    });
  }

  public async details(gameId: string): Promise<AdminGameDetailsData> {
    const [game, entity] = await Promise.all([
      this.gameService.get(gameId),
      this.gameService.getGameEntity(gameId)
    ]);

    return {
      game,
      isPaused: entity.gameState.isPaused,
      players: entity.players.map((p) => ({
        id: p.meta.id,
        username: p.meta.username,
        avatar: p.meta.avatar ?? null,
        role: p.role,
        status: p.gameStatus,
        score: p.score,
        slot: p.gameSlot
      }))
    };
  }

  public async kick(adminUserId: number, gameId: string, playerId: number): Promise<void> {
    const game = await this.gameService.getGameEntity(gameId);

    if (!game.getPlayer(playerId, { fetchDisconnected: false })) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    await this.submit(GameActionType.ADMIN_PLAYER_KICK, gameId, { playerId });

    this.logger.audit("Moderator kicked a player from a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId,
      gameId,
      targetUserId: playerId
    });
  }

  public async setPaused(adminUserId: number, gameId: string, paused: boolean): Promise<void> {
    await this.gameService.getGameEntity(gameId);

    await this.submit(
      paused ? GameActionType.ADMIN_GAME_PAUSE : GameActionType.ADMIN_GAME_UNPAUSE,
      gameId,
      {}
    );

    this.logger.audit(paused ? "Moderator paused a game" : "Moderator resumed a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId,
      gameId
    });
  }

  /**
   * Ends a game for everyone. The queued action tells the room and deletes
   * the game; then the sockets leave the room and the leftovers go.
   */
  public async close(adminUserId: number, gameId: string): Promise<void> {
    await this.gameService.getGameEntity(gameId);

    await this.submit(GameActionType.ADMIN_GAME_CLOSE, gameId, {});

    const socketIds = await this.realtimeGateway.getRoomSocketIds(gameId);
    await Promise.all(
      socketIds.map(async (socketId) => {
        this.realtimeGateway.leaveRoom(socketId, gameId);
        await this.socketUserDataService.update(socketId, { gameId: JSON.stringify(null) });
      })
    );

    await this.gameRepository.clearAllTimers(gameId);
    await this.packageStore.deletePackage(gameId);

    const deleted: GameEventDTO = { event: GameEvent.DELETED, data: { id: gameId } };
    this.realtimeGateway.publish(RealtimeEvents.toAll(SocketIOEvents.GAMES, deleted));

    this.logger.audit("Moderator closed a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId,
      gameId,
      socketsRemoved: socketIds.length
    });
  }

  private async submit(type: GameActionType, gameId: string, payload: unknown): Promise<void> {
    const action: GameAction = {
      id: ValueUtils.generateUUID(),
      type,
      gameId,
      playerId: SYSTEM_PLAYER_ID,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload
    };

    const result = await this.actionExecutor.submitAction(action);

    if (!result.success) {
      throw new ClientError(result.error ?? "Moderation action failed");
    }
  }
}
