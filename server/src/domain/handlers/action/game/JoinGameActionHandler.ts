import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { UserService } from "application/services/user/UserService";
import { GAME_CHAT_HISTORY_RETRIEVAL_LIMIT } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  GameJoinInputData,
  GameJoinOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for player joining a game.
 * Socket-specific operations (room join, notifications) handled in socket handler's afterHandle.
 */
export class JoinGameActionHandler
  implements GameActionHandler<GameJoinInputData, GameJoinOutputData>
{
  constructor(
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketIOChatService: SocketIOChatService,
    private readonly userService: UserService,
    private readonly socketGameContextService: SocketGameContextService
  ) {}

  public async execute(
    action: GameAction<GameJoinInputData>
  ): Promise<GameActionHandlerResult<GameJoinOutputData>> {
    const { socketId, payload } = action;

    // Fetch user data
    const userData = await this.socketGameContextService.fetchUserSocketData(
      socketId
    );
    const user = await this.userService.get(userData.id);
    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    // Join player through service
    const result = await this.socketIOGameService.joinPlayer(
      payload,
      user,
      socketId
    );
    const { player, game } = result;

    // Prepare the response data
    const gameJoinData: GameJoinOutputData = {
      meta: {
        title: game.title,
      },
      players: game.players.map((p) => p.toDTO()),
      gameState: game.gameState,
      chatMessages: await this.socketIOChatService.getMessages(
        game.id,
        game.createdAt,
        GAME_CHAT_HISTORY_RETRIEVAL_LIMIT
      ),
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.JOIN,
        data: player.toDTO(),
        target: SocketBroadcastTarget.GAME,
        gameId: payload.gameId,
      },
      {
        event: SocketIOGameEvents.GAME_DATA,
        data: gameJoinData,
        target: SocketBroadcastTarget.SOCKET,
        socketId: socketId,
      },
    ];

    return { success: true, data: gameJoinData, broadcasts };
  }
}
