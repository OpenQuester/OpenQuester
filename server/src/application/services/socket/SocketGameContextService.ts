import { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameContext } from "domain/types/socket/game/GameContext";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { type ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";

/**
 * Service responsible for fetching and validating socket game context.
 */

export class SocketGameContextService {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService,
    private readonly logger: ILogger
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

    // Log user activity for debugging (no additional Redis calls)
    this.logger.debug(
      `User ${userSession.id} performing socket action | SocketId: ${socketId} | GameId: ${userSession.gameId}`,
      { prefix: "[SOCKET]: " }
    );

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

    // Log user activity for debugging (no additional Redis calls)
    this.logger.debug(
      `User ${userData.id} socket activity | SocketId: ${socketId} | GameId: ${
        userData.gameId || "none"
      }`,
      { prefix: "[SOCKET]: " }
    );

    return userData;
  }
}
