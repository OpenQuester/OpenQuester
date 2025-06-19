import { REDIS_LOCK_SESSIONS_CLEANUP } from "domain/constants/redis";
import {
  SOCKET_GAME_AUTH_TTL,
  SOCKET_USER_REDIS_NSP,
} from "domain/constants/socket";
import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class SocketUserDataRepository {
  constructor(private readonly redisService: RedisService) {
    //
  }

  public async getRaw(socketId: string) {
    return this.redisService.hgetall(this._getKey(socketId));
  }

  public async getSocketData(
    socketId: string
  ): Promise<SocketRedisUserData | null> {
    const data: Record<string, string> = await this.getRaw(socketId);

    return data && !ValueUtils.isEmpty(data)
      ? {
          id: parseInt(data.id),
          gameId: data.gameId === "null" ? null : data.gameId,
        }
      : null;
  }

  public async set(
    socketId: string,
    data: { userId: number; language: string }
  ) {
    return this.redisService.hset(
      this._getKey(socketId),
      {
        id: data.userId,
        language: data.language,
      },
      SOCKET_GAME_AUTH_TTL
    );
  }

  public async update(socketId: string, data: SocketRedisUserUpdateDTO) {
    return this.redisService.hset(
      this._getKey(socketId),
      data,
      SOCKET_GAME_AUTH_TTL
    );
  }

  public async remove(socketId: string) {
    return this.redisService.del(this._getKey(socketId));
  }

  /**
   * Cleans up all socket auth sessions since on server restart connections recreated
   */
  public async cleanupAllSession(): Promise<void> {
    const acquired = await this.redisService.setLockKey(
      REDIS_LOCK_SESSIONS_CLEANUP
    );

    if (!acquired) {
      return; // Another instance acquired the lock
    }

    return this.redisService.cleanupKeys(this._getKey("*"), "socket session");
  }

  private _getKey(socketId: string) {
    return `${SOCKET_USER_REDIS_NSP}:${socketId}`;
  }
}
