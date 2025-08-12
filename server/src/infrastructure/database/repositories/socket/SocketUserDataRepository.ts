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
    const pattern = this._getKey(socketId, null); // will contain wildcard in place of userId
    const keys = await this.redisService.scan(pattern);
    if (!keys.length) {
      return {} as Record<string, string>;
    }
    // Expect exactly one key; if multiple (edge case), pick first.
    return this.redisService.hgetall(keys[0]);
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
    // Store only under the userId-inclusive key: <nsp>:<userId>:<socketId>
    await this.redisService.hset(
      this._getKey(socketId, data.userId),
      {
        id: data.userId,
        language: data.language,
      },
      SOCKET_GAME_AUTH_TTL
    );
  }

  public async update(socketId: string, data: SocketRedisUserUpdateDTO) {
    // Require id presence for update to ensure we can target the correct composite key
    let userId: number | null = null;
    if (data.id) {
      try {
        userId = parseInt(
          JSON.parse((data.id as unknown as string) || (data.id as string))
        );
      } catch {
        userId = parseInt(data.id as string);
      }
    }

    if (userId && !Number.isNaN(userId)) {
      await this.redisService.hset(
        this._getKey(socketId, userId),
        data,
        SOCKET_GAME_AUTH_TTL
      );
    }
  }

  public async remove(socketId: string) {
    // Single key deletion: need to resolve userId via scan since we only have socketId
    const pattern = `${SOCKET_USER_REDIS_NSP}:*:${socketId}`;
    const keys = await this.redisService.scan(pattern);
    if (keys.length === 0) return 0;

    let deleted = 0;
    for (const k of keys) {
      deleted += await this.redisService.del(k);
    }

    return deleted;
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

    return this.redisService.cleanupKeys(
      `${SOCKET_USER_REDIS_NSP}:*:*`,
      "socket session"
    );
  }

  private _getKey(socketId: string, userId: number | null) {
    return `${SOCKET_USER_REDIS_NSP}:${userId ? userId : "*"}:${socketId}`;
  }
}
