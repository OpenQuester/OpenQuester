import { inject, singleton } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameService } from "application/services/game/GameService";
import { SYSTEM_PLAYER_ID, SYSTEM_SOCKET_ID } from "domain/constants/game";
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
 * and live actions on it.
 *
 * Live actions are the showman's own actions (kick, pause, resume) submitted
 * with `moderatorId`, plus `ADMIN_GAME_CLOSE`. They go through
 * {@link GameActionExecutor}, so they queue behind in-flight player actions,
 * and everything that has to happen afterwards runs in the action's use case
 * and post-action hook, not here.
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
    const game = await this.gameService.gameToListItemDTO(entity);

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

  public async kick(moderatorId: number, gameId: string, playerId: number): Promise<void> {
    const game = await this.gameService.getGameEntity(gameId);

    if (!game.getPlayer(playerId, { fetchDisconnected: false })) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    await this.submitAction(GameActionType.PLAYER_KICK, moderatorId, gameId, { playerId });

    this.logger.audit("Moderator kicked a player from a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId: moderatorId,
      gameId,
      targetUserId: playerId
    });
  }

  public async setPaused(moderatorId: number, gameId: string, paused: boolean): Promise<void> {
    await this.gameService.getGameEntity(gameId);

    const type = paused ? GameActionType.PAUSE : GameActionType.UNPAUSE;
    await this.submitAction(type, moderatorId, gameId, {});

    this.logger.audit(paused ? "Moderator paused a game" : "Moderator resumed a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId: moderatorId,
      gameId
    });
  }

  /**
   * Ends a game for everyone. `ADMIN_GAME_CLOSE` tells the room and deletes
   * the game; its post-action hook then empties the room and cleans up.
   */
  public async close(moderatorId: number, gameId: string): Promise<void> {
    await this.gameService.getGameEntity(gameId);

    await this.submitAction(GameActionType.ADMIN_GAME_CLOSE, moderatorId, gameId, {});

    this.logger.audit("Moderator closed a game", {
      prefix: LogPrefix.ADMIN,
      adminUserId: moderatorId,
      gameId
    });
  }

  private async submitAction(
    type: GameActionType,
    moderatorId: number,
    gameId: string,
    payload: unknown
  ): Promise<void> {
    const action: GameAction = {
      id: ValueUtils.generateUUID(),
      type,
      gameId,
      playerId: SYSTEM_PLAYER_ID,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload,
      moderatorId
    };

    const result = await this.actionExecutor.submitAction(action);

    if (!result.success) {
      throw new ClientError(result.error ?? "Moderation action failed");
    }
  }
}
