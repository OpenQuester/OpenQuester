import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
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

  async fetchGameContext(socketId: string): Promise<GameContext> {
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
  async fetchUserSocketData(socketId: string): Promise<SocketRedisUserData> {
    const userData = await this.socketUserDataService.getSocketData(socketId);

    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    return userData;
  }
}
