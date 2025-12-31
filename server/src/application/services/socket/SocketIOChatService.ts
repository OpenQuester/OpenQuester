import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ChatMessageDTO } from "domain/types/dto/game/chat/ChatMessageDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatSaveInputData } from "domain/types/socket/chat/ChatSaveInputData";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { SocketGameContextService } from "./SocketGameContextService";

export class SocketIOChatService {
  constructor(
    private readonly socketChatRepository: SocketChatRepository,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly userService: UserService
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

    const player = context.game.getPlayer(context.userSession.id, {
      fetchDisconnected: true,
    });

    // Check global mute status
    const user = await this.userService.getRaw(context.userSession.id, {
      select: ["id", "muted_until"],
      relations: [],
    });

    if (user.isMuted) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }

    // Check game-level mute
    const isMuted = context.game.isPlayerMuted(context.userSession.id);

    // Check if player is muted first
    if (isMuted) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }

    // Check spectator restrictions only when someone is answering
    const isSpectator = player?.role === PlayerRole.SPECTATOR;
    const someoneIsAnswering = context.game.gameState.answeringPlayer !== null;

    if (isSpectator && someoneIsAnswering) {
      throw new ClientError(
        ClientResponse.SPECTATORS_CANNOT_CHAT_WHILE_ANSWERING
      );
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
