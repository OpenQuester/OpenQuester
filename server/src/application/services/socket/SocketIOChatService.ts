import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ChatMessageDTO } from "domain/types/dto/game/chat/ChatMessageDTO";
import { ChatSaveInputData } from "domain/types/socket/chat/ChatSaveInputData";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { GameService } from "../game/GameService";

export class SocketIOChatService {
  constructor(
    private readonly socketChatRepository: SocketChatRepository,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly gameService: GameService
  ) {
    //
  }

  public async getMessages(gameId: string, gameCreatedAt: Date, limit: number) {
    return this.socketChatRepository.getMessages(gameId, gameCreatedAt, limit);
  }

  public async saveChatMessage(data: ChatSaveInputData) {
    return this.socketChatRepository.saveChatMessage(data);
  }

  public async processChatMessage(
    socketId: string,
    message: string
  ): Promise<ChatMessageDTO> {
    const userData = await this._fetchUserSocketData(socketId);
    const gameId = userData.gameId;

    if (!gameId) {
      throw new ClientError(ClientResponse.NOT_IN_GAME);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );

    const isMuted = game.isPlayerMuted(userData.id);

    if (isMuted) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }

    const chatMessage = await this.saveChatMessage({
      gameId,
      message,
      gameCreatedAt: game.createdAt,
      user: userData.id,
    });

    return chatMessage;
  }

  private async _fetchUserSocketData(socketId: string) {
    const userData = await this.socketUserDataService.getSocketData(socketId);

    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    return userData;
  }
}
