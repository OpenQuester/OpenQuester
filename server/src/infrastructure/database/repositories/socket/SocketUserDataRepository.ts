import { singleton } from "tsyringe";

import { REDIS_LOCK_SESSIONS_CLEANUP } from "domain/constants/redis";
import {
  SOCKET_GAME_AUTH_TTL,
  SOCKET_SESSION_PREFIX,
  SOCKET_USER_MUTE_PREFIX,
  SOCKET_USER_PREFIX
} from "domain/constants/socket";
import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { asUserId } from "domain/types/ids";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { ValueUtils } from "domain/utils/ValueUtils";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { type SingleInstanceSocketSessionCleanupResult } from "domain/types/recovery/SingleInstanceRestartRecoveryResult";

/**
 * Repository for socket user session data (stored in Redis).
 *
 * Key structure:
 * - socket:session:{socketId} -> HASH { id: userId, gameId: string | null, mutedUntil: string | null }
 * - socket:user:{userId} -> STRING socketId
 * - socket:user:mute:{userId} -> STRING 1, expires when a global mute expires
 *
 * All lookups are O(1) without SCAN in business logic.
 */
@singleton()
export class SocketUserDataRepository {
  constructor(private readonly redisRepository: RedisRepository) {
    //
  }

  private getSessionKey(socketId: string): string {
    return `${SOCKET_SESSION_PREFIX}:${socketId}`;
  }

  private getUserKey(userId: number): string {
    return `${SOCKET_USER_PREFIX}:${userId}`;
  }

  private getUserMuteKey(userId: number): string {
    return `${SOCKET_USER_MUTE_PREFIX}:${userId}`;
  }

  private serializeMutedUntil(mutedUntil: string | Date | null | undefined): string {
    if (!mutedUntil) {
      return "null";
    }

    return mutedUntil instanceof Date ? mutedUntil.toISOString() : mutedUntil;
  }

  private parseMutedUntil(value: string | null | undefined): string | null {
    return !value || value === "null" ? null : value;
  }

  /**
   * Get socket session data by socketId (O(1)).
   */
  public async getSocketData(socketId: string): Promise<SocketRedisUserData | null> {
    try {
      const data = await this.redisRepository.hgetall(this.getSessionKey(socketId));

      if (!data || ValueUtils.isEmpty(data)) {
        return null;
      }

      return {
        id: asUserId(parseInt(data.id, 10)),
        gameId: data.gameId === "null" || !data.gameId ? null : data.gameId,
        mutedUntil: this.parseMutedUntil(data.mutedUntil)
      };
    } catch {
      return null;
    }
  }

  /**
   * Batch get socket session data by socketIds using a pipeline.
   */
  public async getSocketDataBatch(
    socketIds: string[]
  ): Promise<Map<string, SocketRedisUserData | null>> {
    if (socketIds.length === 0) {
      return new Map();
    }

    const pipeline = this.redisRepository.pipeline();
    const keys = socketIds.map((socketId) => this.getSessionKey(socketId));

    for (const key of keys) {
      pipeline.hgetall(key);
    }

    const results = await pipeline.exec();
    const resultMap = new Map<string, SocketRedisUserData | null>();

    if (!results) {
      return resultMap;
    }

    for (let i = 0; i < results.length; i += 1) {
      const entry = results[i];
      const socketId = socketIds[i];

      if (!entry || !socketId) {
        continue;
      }

      const [err, data] = entry;

      if (err || !data || typeof data !== "object") {
        resultMap.set(socketId, null);
        continue;
      }

      const record = data as Record<string, string>;

      if (ValueUtils.isEmpty(record)) {
        resultMap.set(socketId, null);
        continue;
      }

      resultMap.set(socketId, {
        id: asUserId(parseInt(record.id, 10)),
        gameId: record.gameId === "null" || !record.gameId ? null : record.gameId,
        mutedUntil: this.parseMutedUntil(record.mutedUntil)
      });
    }

    return resultMap;
  }

  /**
   * Create socket session and reverse lookup atomically (MULTI/EXEC).
   */
  public async set(
    socketId: string,
    data: { userId: number; language: string; mutedUntil?: string | Date | null }
  ): Promise<void> {
    const sessionKey = this.getSessionKey(socketId);
    const userKey = this.getUserKey(data.userId);

    const multi = this.redisRepository.multi();
    multi.hset(sessionKey, {
      id: data.userId.toString(),
      gameId: "null",
      mutedUntil: this.serializeMutedUntil(data.mutedUntil)
    });
    multi.expire(sessionKey, SOCKET_GAME_AUTH_TTL);
    multi.set(userKey, socketId, "EX", SOCKET_GAME_AUTH_TTL);

    const results = await multi.exec();

    if (!results) {
      throw new Error("Failed to create socket session: transaction returned null");
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
    if (data.mutedUntil !== undefined) {
      updateData.mutedUntil = this.serializeMutedUntil(data.mutedUntil);
    }
    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.redisRepository.hset(this.getSessionKey(socketId), updateData, SOCKET_GAME_AUTH_TTL);
  }

  /**
   * Remove socket session and reverse lookup atomically.
   */
  public async remove(socketId: string) {
    const sessionKey = this.getSessionKey(socketId);
    const userId = await this.redisRepository.hget(sessionKey, "id");

    if (!userId) {
      return 0;
    }

    const userKey = this.getUserKey(parseInt(userId, 10));
    const multi = this.redisRepository.multi();
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
    return this.redisRepository.get(this.getUserKey(userId));
  }

  public async setUserMuteExpiration(
    userId: number,
    mutedUntil: string | Date | null
  ): Promise<void> {
    const key = this.getUserMuteKey(userId);

    if (!mutedUntil) {
      await this.redisRepository.del(key);
      return;
    }

    const expiresAt = new Date(mutedUntil).getTime();
    const ttlMs = expiresAt - Date.now();

    if (!Number.isFinite(expiresAt) || ttlMs <= 0) {
      await this.redisRepository.del(key);
      return;
    }

    await this.redisRepository.set(key, "1", ttlMs);
  }

  public async clearUserMuteExpiration(userId: number): Promise<void> {
    await this.redisRepository.del(this.getUserMuteKey(userId));
  }

  /**
   * Clear all socket sessions only for a single-instance restart. This removes
   * stale sockets for the one server runtime that was fully offline.
   */
  public async clearAllSocketSessionsAfterSingleInstanceRestart(): Promise<SingleInstanceSocketSessionCleanupResult> {
    const acquired = await this.redisRepository.setLockKey(REDIS_LOCK_SESSIONS_CLEANUP);

    if (acquired !== "OK") {
      return { status: "lock-not-acquired" };
    }

    const sessionKeys = await this.redisRepository.scan(`${SOCKET_SESSION_PREFIX}:*`);
    let removedSocketSessions = 0;
    if (sessionKeys.length) {
      removedSocketSessions = await this.redisRepository.delMultiple(sessionKeys);
    }

    const userKeys = await this.redisRepository.scan(`${SOCKET_USER_PREFIX}:*`);
    let removedUserSocketLookups = 0;
    if (userKeys.length) {
      removedUserSocketLookups = await this.redisRepository.delMultiple(userKeys);
    }

    return {
      status: "completed",
      removedSocketSessions,
      removedUserSocketLookups
    };
  }
}
