import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type ChatMessageBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import { asUserId, userId } from "domain/types/ids";

/**
 * Handles chat messages.
 *
 * Executed via direct execution (bypasses lock/queue) because chat messages
 * don't affect game state and don't need synchronization.
 *
 * Uses ctx.game for game-level mute/spectator checks.
 * Queries only the user's global mute field because this is a DB-backed
 * moderation policy and stale negative socket caches are not safe enough.
 */
export class ChatMessageUseCase implements GameActionHandler<
  ChatMessageInputData,
  ChatMessageBroadcastData
> {
  constructor(
    private readonly userService: UserService,
    private readonly socketChatRepository: SocketChatRepository
  ) {}

  public async execute(
    ctx: ActionExecutionContext<ChatMessageInputData>
  ): Promise<ActionHandlerResult<ChatMessageBroadcastData>> {
    const { game, userData, action } = ctx;
    const userId = asUserId(userData!.id);

    const player = game.getPlayer(userId, { fetchDisconnected: true });

    await this.validateMuteState(userId, game.isPlayerMuted(userId));

    // Check spectator restrictions only when someone is answering
    const isSpectator = player?.role === PlayerRole.SPECTATOR;
    const someoneIsAnswering = game.gameState.answeringPlayer !== null;

    if (isSpectator && someoneIsAnswering) {
      throw new ClientError(ClientResponse.SPECTATORS_CANNOT_CHAT_WHILE_ANSWERING);
    }

    const chatMessage = await this.socketChatRepository.saveChatMessage({
      gameId: action.gameId,
      message: action.payload.message.trim(),
      gameCreatedAt: game.createdAt,
      user: userId
    });

    const payload: ChatMessageBroadcastData = {
      uuid: chatMessage.uuid,
      timestamp: chatMessage.timestamp,
      user: chatMessage.user,
      message: chatMessage.message
    };

    return {
      success: true,
      data: payload,
      mutations: [
        DataMutationConverter.gameBroadcastMutation(
          action.gameId,
          SocketIOEvents.CHAT_MESSAGE,
          payload
        )
      ]
    };
  }

  private async validateMuteState(userId: userId, isGameMuted: boolean): Promise<void> {
    if (isGameMuted) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }

    if (await this.userService.isGloballyMuted(userId)) {
      throw new ClientError(ClientResponse.YOU_ARE_MUTED);
    }
  }
}
