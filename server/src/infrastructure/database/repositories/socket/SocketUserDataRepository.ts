import { singleton } from "tsyringe";

import { REDIS_LOCK_SESSIONS_CLEANUP } from "domain/constants/redis";
import {
  SOCKET_GAME_AUTH_TTL,
  SOCKET_SESSION_PREFIX,
  SOCKET_USER_PREFIX,
} from "domain/constants/socket";
import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Repository for socket user session data (stored in Redis).
 *
 * Key structure:
 * - socket:session:{socketId} -> HASH { id: userId, gameId: string | null }
 * - socket:user:{userId} -> STRING socketId
 *
 * All lookups are O(1) without SCAN in business logic.
 */
@singleton()
export class SocketUserDataRepository {
  constructor(private readonly redisService: RedisService) {
    //
  }

  private getSessionKey(socketId: string): string {
    return `${SOCKET_SESSION_PREFIX}:${socketId}`;
  }

  private getUserKey(userId: number): string {
    return `${SOCKET_USER_PREFIX}:${userId}`;
  }

  /**
   * Get socket session data by socketId (O(1)).
   */
  public async getSocketData(
    socketId: string
  ): Promise<SocketRedisUserData | null> {
    const data = await this.redisService.hgetall(this.getSessionKey(socketId));

    if (!data || ValueUtils.isEmpty(data)) {
      return null;
    }

    return {
      id: parseInt(data.id, 10),
      gameId: data.gameId === "null" || !data.gameId ? null : data.gameId,
    };
  }

  /**
   * Create socket session and reverse lookup atomically (MULTI/EXEC).
   */
  public async set(
    socketId: string,
    data: { userId: number; language: string }
  ): Promise<void> {
    const sessionKey = this.getSessionKey(socketId);
    const userKey = this.getUserKey(data.userId);

    const multi = this.redisService.multi();
    multi.hset(sessionKey, {
      id: data.userId.toString(),
      gameId: "null",
    });
    multi.expire(sessionKey, SOCKET_GAME_AUTH_TTL);
    multi.set(userKey, socketId, "EX", SOCKET_GAME_AUTH_TTL);

    const results = await multi.exec();

    if (!results) {
      throw new Error(
        "Failed to create socket session: transaction returned null"
      );
    }

    for (const [err] of results) {
      if (err) {
        throw err;
      }
    }
  }

  /**
   * Update socket session (gameId/id) with TTL refresh.
   */
  public async update(socketId: string, data: SocketRedisUserUpdateDTO) {
    const updateData: Record<string, string> = {};

    if (data.id !== undefined) {
      updateData.id = data.id;
    }
    if (data.gameId !== undefined) {
      updateData.gameId = data.gameId;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.redisService.hset(
      this.getSessionKey(socketId),
      updateData,
      SOCKET_GAME_AUTH_TTL
    );
  }

  /**
   * Remove socket session and reverse lookup atomically.
   */
  public async remove(socketId: string) {
    const sessionKey = this.getSessionKey(socketId);
    const userId = await this.redisService.hget(sessionKey, "id");

    if (!userId) {
      return 0;
    }

    const userKey = this.getUserKey(parseInt(userId, 10));
    const multi = this.redisService.multi();
    multi.del(sessionKey);
    multi.del(userKey);

    const results = await multi.exec();

    if (!results) {
      return 0;
    }

    let deleted = 0;
    for (const [err, result] of results) {
      if (!err && ValueUtils.isNumber(result)) {
        deleted += result;
      }
    }

    return deleted;
  }

  /**
   * Find socketId by userId (O(1)).
   */
  public async findSocketIdByUserId(userId: number): Promise<string | null> {
    return this.redisService.get(this.getUserKey(userId));
  }

  /**
   * Cleanup all socket sessions (uses SCAN; acceptable for maintenance).
   */
  public async cleanupAllSession(): Promise<void> {
    const acquired = await this.redisService.setLockKey(
      REDIS_LOCK_SESSIONS_CLEANUP
    );

    if (acquired !== "OK") {
      return;
    }

    const sessionKeys = await this.redisService.scan(
      `${SOCKET_SESSION_PREFIX}:*`
    );
    if (sessionKeys.length) {
      await this.redisService.delMultiple(sessionKeys);
    }

    const userKeys = await this.redisService.scan(`${SOCKET_USER_PREFIX}:*`);
    if (userKeys.length) {
      await this.redisService.delMultiple(userKeys);
    }
  }
}
