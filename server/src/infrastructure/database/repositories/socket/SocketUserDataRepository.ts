import { singleton } from "tsyringe";

import { REDIS_LOCK_SESSIONS_CLEANUP } from "domain/constants/redis";
import {
  SOCKET_GAME_AUTH_TTL,
  SOCKET_USER_REDIS_NSP,
} from "domain/constants/socket";
import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Repository for socket user session data (stored in Redis).
 */
@singleton()
export class SocketUserDataRepository {
  constructor(private readonly redisService: RedisService) {
    //
  }

  public async getRaw(socketId: string) {
    const keys = await this._findKeysBySocketId(socketId);
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
    const keys = await this._findKeysBySocketId(socketId);
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

  /**
   * Find the socket ID for a specific user ID
   * Since users can only have one socket in the game, this is more efficient than scanning all sockets
   */
  public async findSocketIdByUserId(userId: number): Promise<string | null> {
    const keys = await this._findKeysByUserId(userId);

    if (keys.length === 0) {
      return null;
    }

    // Extract socket ID from the Redis key: socket:user:${userId}:${socketId}
    // Since users can only have one socket, we take the first (and should be only) match
    const socketId = keys[0].split(":").pop();
    return socketId || null;
  }

  /**
   * Helper method to find Redis keys by socketId (reverse lookup: socketId -> userId)
   * Used by getRaw() and remove() methods
   */
  private async _findKeysBySocketId(socketId: string): Promise<string[]> {
    const pattern = `${SOCKET_USER_REDIS_NSP}:*:${socketId}`;
    return this.redisService.scan(pattern);
  }

  /**
   * Helper method to find Redis keys by userId (forward lookup: userId -> socketId)
   * Used by findSocketIdByUserId() method
   */
  private async _findKeysByUserId(userId: number): Promise<string[]> {
    const pattern = `${SOCKET_USER_REDIS_NSP}:${userId}:*`;
    return this.redisService.scan(pattern);
  }

  private _getKey(socketId: string, userId: number | null) {
    return `${SOCKET_USER_REDIS_NSP}:${userId ? userId : "*"}:${socketId}`;
  }
}
