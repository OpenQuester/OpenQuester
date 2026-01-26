import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ActionContext } from "domain/types/action/ActionContext";
import { GameContext } from "domain/types/socket/game/GameContext";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

/**
 * Service responsible for fetching and validating socket game context.
 */
@singleton()
export class SocketGameContextService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService
  ) {
    //
  }

  /**
   * Lightweight getter for gameId without loading the full game entity.
   * Reduces duplicated Redis calls when only the queue routing is needed.
   */
  public async getGameIdForSocket(socketId: string): Promise<string | null> {
    const userData = await this.socketUserDataService.getSocketData(socketId);
    return userData?.gameId ?? null;
  }

  public async loadGameAndPlayer(ctx: ActionContext) {
    const game = await this.gameService.getGameEntity(
      ctx.gameId,
      GAME_TTL_IN_SECONDS
    );

    if (!game) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND);
    }

    const currentPlayer = game.getPlayer(ctx.playerId, {
      fetchDisconnected: false,
    });

    return { game, currentPlayer };
  }

  public async fetchGameContext(socketId: string): Promise<GameContext> {
    const userSession = await this.fetchUserSocketData(socketId);

    if (!userSession.gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      userSession.gameId,
      GAME_TTL_IN_SECONDS
    );

    const currentPlayer = game.getPlayer(userSession.id, {
      fetchDisconnected: false,
    });

    return new GameContext(userSession, game, currentPlayer);
  }

  /**
   * Throws an error if the user is not authenticated or does not have socket data.
   */
  public async fetchUserSocketData(
    socketId: string
  ): Promise<SocketRedisUserData> {
    const userData = await this.socketUserDataService.getSocketData(socketId);

    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    return userData;
  }

  /**
   * Batch fetch socket user data. Throws if any socket is not authenticated.
   */
  public async fetchUserSocketDataBatch(
    socketIds: string[]
  ): Promise<Map<string, SocketRedisUserData>> {
    const userDataMap = await this.socketUserDataService.getSocketDataBatch(
      socketIds
    );

    const result = new Map<string, SocketRedisUserData>();

    for (const socketId of socketIds) {
      const userData = userDataMap.get(socketId);

      if (!userData) {
        throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
      }

      result.set(socketId, userData);
    }

    return result;
  }
}
