import { singleton } from "tsyringe";

import { GAME_CHAT_NSP, GAME_CHAT_TTL } from "domain/constants/game";
import { ChatMapper } from "domain/mappers/ChatMapper";
import { ChatMessageDTO } from "domain/types/dto/game/chat/ChatMessageDTO";
import { ChatSaveInputData } from "domain/types/socket/chat/ChatSaveInputData";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Repository for game chat messages (stored in Redis).
 */
@singleton()
export class SocketChatRepository {
  constructor(private readonly redisService: RedisService) {
    //
  }

  private getGameChatKey(gameId: string, createdAt: Date) {
    return `${GAME_CHAT_NSP}:${gameId}:${createdAt.getTime()}`;
  }

  public async saveChatMessage(
    data: ChatSaveInputData
  ): Promise<ChatMessageDTO> {
    const messageId = ValueUtils.generateUUID();

    const message: Omit<ChatMessageDTO, "gameId"> = {
      message: data.message,
      uuid: messageId,
      user: data.user,
      timestamp: new Date(),
    };

    const key = this.getGameChatKey(data.gameId, data.gameCreatedAt);

    await this.redisService.zadd(key, [
      message.timestamp.getTime(),
      JSON.stringify(message),
    ]);

    await this.redisService.expire(key, GAME_CHAT_TTL);

    return {
      ...message,
      gameId: data.gameId,
    };
  }

  public async getMessages(gameId: string, gameCreatedAt: Date, limit: number) {
    const messages = await this.redisService.zrevrange(
      this.getGameChatKey(gameId, gameCreatedAt),
      0,
      limit - 1
    );

    return ChatMapper.serializeChatMessages(messages);
  }
}
