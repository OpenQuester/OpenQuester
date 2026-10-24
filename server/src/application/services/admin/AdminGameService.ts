import { inject, singleton } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameService } from "application/services/game/GameService";
import { SYSTEM_SOCKET_ID } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import {
  type AdminGameDetailsData,
  type AdminGameListData,
  type AdminGameListQuery
} from "domain/types/admin/AdminTypes";
import { type GameAction } from "domain/types/action/GameAction";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { ValueUtils } from "domain/utils/ValueUtils";
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
    private readonly actionExecutor: GameActionExecutor,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async list(query: AdminGameListQuery): Promise<AdminGameListData> {
    return this.gameService.list({
      limit: query.limit,
      offset: query.offset,
      sortBy: "createdAt",
      order: PaginationOrder.DESC,
      ...(query.search ? { titlePrefix: query.search } : {})
    });
  }

  public async details(gameId: string): Promise<AdminGameDetailsData> {
    const entity = await this.gameService.getGameEntity(gameId);
    const game = await this.gameService.getGameListItem(entity);

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

    await this.submitAction(adminUserId, GameActionType.PLAYER_KICK, gameId, { playerId });

    this.logger.audit("Moderator kicked a player from a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId,
      gameId,
      targetUserId: playerId
    });
  }

  public async setPaused(adminUserId: number, gameId: string, paused: boolean): Promise<void> {
    await this.gameService.getGameEntity(gameId);

    await this.submitAction(
      adminUserId,
      paused ? GameActionType.PAUSE : GameActionType.UNPAUSE,
      gameId,
      {}
    );

    this.logger.audit(paused ? "Moderator paused a game" : "Moderator resumed a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId,
      gameId
    });
  }

  /** The queued action owns deletion, broadcasts and post-execution cleanup. */
  public async close(adminUserId: number, gameId: string): Promise<void> {
    await this.submitAction(adminUserId, GameActionType.ADMIN_GAME_CLOSE, gameId, {});
  }

  private async submitAction(
    adminUserId: number,
    type: GameActionType,
    gameId: string,
    payload: unknown
  ): Promise<void> {
    const action: GameAction = {
      id: ValueUtils.generateUUID(),
      type,
      gameId,
      playerId: adminUserId,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload
    };

    const result = await this.actionExecutor.submitAction(action);

    if (!result.success) {
      throw new ClientError(result.error ?? "Moderation action failed", result.errorCode);
    }
  }
}
