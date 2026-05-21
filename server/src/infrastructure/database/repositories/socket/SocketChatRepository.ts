import { singleton } from "tsyringe";

import { GAME_CHAT_NSP, GAME_CHAT_TTL } from "domain/constants/game";
import { ChatMapper } from "domain/mappers/ChatMapper";
import { ChatMessageDTO } from "domain/types/dto/game/chat/ChatMessageDTO";
import { ChatSaveInputData } from "domain/types/socket/chat/ChatSaveInputData";
import { ValueUtils } from "domain/utils/ValueUtils";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";

/**
 * Repository for game chat messages (stored in Redis).
 */
@singleton()
export class SocketChatRepository {
  private messageOrderCounter = 0;

  constructor(private readonly redisRepository: RedisRepository) {
    //
  }

  private getGameChatKey(gameId: string, createdAt: Date) {
    return `${GAME_CHAT_NSP}:${gameId}:${createdAt.getTime()}`;
  }

  public async saveChatMessage(data: ChatSaveInputData): Promise<ChatMessageDTO> {
    const messageId = ValueUtils.generateUUID();

    const message: Omit<ChatMessageDTO, "gameId"> = {
      message: data.message,
      uuid: messageId,
      user: data.user,
      timestamp: new Date()
    };

    const key = this.getGameChatKey(data.gameId, data.gameCreatedAt);

    await this.redisRepository.zadd(key, [
      this.buildMessageOrderScore(message.timestamp),
      JSON.stringify(message)
    ]);

    await this.redisRepository.expire(key, GAME_CHAT_TTL);

    return {
      ...message,
      gameId: data.gameId
    };
  }

  public async getMessages(gameId: string, gameCreatedAt: Date, limit: number) {
    const messages = await this.redisRepository.zrevrange(
      this.getGameChatKey(gameId, gameCreatedAt),
      0,
      limit - 1
    );

    return ChatMapper.serializeChatMessages(messages);
  }

  private buildMessageOrderScore(timestamp: Date): number {
    this.messageOrderCounter = (this.messageOrderCounter + 1) % 1_000;

    // Redis sorted sets use the score for history order; the counter breaks same-ms ties.
    return timestamp.getTime() * 1_000 + this.messageOrderCounter;
  }
}
