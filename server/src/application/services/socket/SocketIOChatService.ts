import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ChatMessageDTO } from "domain/types/dto/game/chat/ChatMessageDTO";
import { ChatSaveInputData } from "domain/types/socket/chat/ChatSaveInputData";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { SocketGameContextService } from "./SocketGameContextService";

export class SocketIOChatService {
  constructor(
    private readonly socketChatRepository: SocketChatRepository,
    private readonly socketGameContextService: SocketGameContextService
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
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );

    const isMuted = context.game.isPlayerMuted(context.userSession.id);
    if (isMuted) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }

    const chatMessage = await this.saveChatMessage({
      gameId: context.userSession.gameId!,
      message: this._sanitize(message),
      gameCreatedAt: context.game.createdAt,
      user: context.userSession.id,
    });

    return chatMessage;
  }

  private _sanitize(message: string): string {
    return message.trim();
  }
}
