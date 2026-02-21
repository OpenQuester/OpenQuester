import { randomUUID } from "crypto";
import { singleton } from "tsyringe";

import {
  COMPARE_AND_DELETE_SCRIPT,
  DRAIN_AND_REACQUIRE_SCRIPT,
} from "application/scripts/actionLuaScripts";
import { SOCKET_SESSION_PREFIX } from "domain/constants/socket";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Result of a lock acquisition attempt.
 */
export interface LockAcquireResult {
  /** Whether the lock was successfully acquired */
  acquired: boolean;
  /** Unique token identifying this lock holder (empty string if not acquired) */
  token: string;
}

/**
 * Result of the atomic drain-and-reacquire operation.
 *
 * Discriminated union on `status`:
 * - `lock-lost`     — token mismatch, caller no longer owns the lock
 * - `queue-empty`   — no more actions, lock was released
 * - `action-popped` — next action dequeued, lock reacquired with new token,
 *                      game hash + timer prefetched in the same atomic op
 */
export type DrainResult =
  | { status: "lock-lost" }
  | { status: "queue-empty" }
  | {
      status: "action-popped";
      /** New lock token (caller must use this for subsequent operations) */
      token: string;
      /** Raw serialized action JSON from the queue */
      action: string;
      /** Raw timer JSON string, or null if no active timer */
      timer: string | null;
      /** Game hash fields as flat key-value record (from HGETALL) */
      gameHash: Record<string, string>;
      /** Socket session hash fields as flat key-value record (from HGETALL), empty if session not found */
      sessionHash: Record<string, string>;
    };

/**
 * Redis-based lock service for game action synchronization.
 *
 * Purpose: Prevent race conditions by ensuring only one action processes per game at a time.
 *
 * Architecture:
 * - Each game has a unique lock key in Redis
 * - Lock is acquired with a unique token (UUID) and auto-expires (TTL=10s) to prevent deadlocks
 * - Release uses Lua compare-and-delete to ensure only the lock owner can release
 * - Drain uses an atomic Lua script that pops the next action, reacquires the lock,
 *   and prefetches game state + timer — all in one round-trip
 * - Used by GameActionExecutor to coordinate action execution
 *
 * Example flow:
 * 1. Action arrives → try acquireLock() → get { acquired, token }
 * 2. If success → process action, releaseLock(gameId, token) when done
 * 3. If failure → action queued in GameActionQueueService
 * 4. After processing → drainAndReacquire() to atomically pop next + keep lock
 */
@singleton()
export class GameActionLockService {
  private readonly LOCK_KEY_PREFIX = "game:action:lock";
  private readonly DEFAULT_LOCK_TTL = 10;

  constructor(private readonly redisService: RedisService) {
    //
  }

  private getLockKey(gameId: string): string {
    return `${this.LOCK_KEY_PREFIX}:${gameId}`;
  }

  /**
   * Attempt to acquire lock for game action processing.
   * Returns a result with whether the lock was acquired and the unique owner token.
   * The token must be passed to releaseLock() to release.
   */
  public async acquireLock(
    gameId: string,
    ttl: number = this.DEFAULT_LOCK_TTL
  ): Promise<LockAcquireResult> {
    const lockKey = this.getLockKey(gameId);
    const token = randomUUID();
    const acquired = await this.redisService.setLockKey(lockKey, ttl, token);

    return {
      acquired: acquired === "OK",
      token,
    };
  }

  /**
   * Release lock for game action processing.
   * Uses compare-and-delete to ensure only the lock owner can release.
   * Returns true if the lock was successfully released, false if the token didn't match.
   */
  public async releaseLock(gameId: string, token: string): Promise<boolean> {
    const lockKey = this.getLockKey(gameId);
    const result = await this.redisService.eval(
      COMPARE_AND_DELETE_SCRIPT,
      1,
      lockKey,
      token
    );
    return result === 1;
  }

  /**
   * Atomically drain the next action from the queue and reacquire the lock.
   *
   * This is the core drain operation: after finishing an action, the executor
   * calls this to check for queued work. The Lua script ensures the lock is
   * never "free" between iterations — preventing external requests from
   * sneaking in during queue draining.
   *
   * Three outcomes:
   * - `lock-lost`: Token mismatch (should not happen in normal flow)
   * - `queue-empty`: No more work, lock released cleanly
   * - `action-popped`: Next action dequeued, lock refreshed with new token,
   *   game state + timer + socket session prefetched (mirrors the IN pipeline — 1 RT)
   *
   * @param lockKey          Fully-qualified lock Redis key
   * @param queueKey         Fully-qualified queue Redis key
   * @param gameKey          Fully-qualified game hash Redis key
   * @param timerKey         Fully-qualified timer Redis key
   * @param currentToken     Current lock token (ownership proof)
   * @param lockTtl          Lock TTL in seconds (default 10)
   * @param gameTtl          Game hash TTL in seconds (refreshed on access)
   * @param sessionKey Full prefix for socket session keys, e.g. "socket:session:"
   */
  public async drainAndReacquire(
    lockKey: string,
    queueKey: string,
    gameKey: string,
    timerKey: string,
    currentToken: string,
    lockTtl: number = this.DEFAULT_LOCK_TTL,
    gameTtl: number
  ): Promise<DrainResult> {
    const newToken = randomUUID();

    const result = (await this.redisService.eval(
      DRAIN_AND_REACQUIRE_SCRIPT,
      4,
      lockKey,
      queueKey,
      gameKey,
      timerKey,
      currentToken,
      newToken,
      lockTtl,
      gameTtl,
      `${SOCKET_SESSION_PREFIX}:`
    )) as (string | number)[];

    const status = result[0] as number;

    if (status === 0) {
      return { status: "lock-lost" };
    }

    if (status === 1) {
      return { status: "queue-empty" };
    }

    // status === 2: action popped, lock reacquired, game + timer + session prefetched
    const token = result[1] as string;
    const action = result[2] as string;
    const rawTimer = result[3] as string;
    const timer = rawTimer === "" ? null : rawTimer;

    // result[4] = sessionFieldCount (total elements in the session flat array)
    const sessionFieldCount = parseInt(result[4] as string, 10);

    // Parse session flat HGETALL array [field1, val1, ...]
    const sessionHash: Record<string, string> = {};
    let idx = 5;
    for (let i = 0; i < sessionFieldCount; i += 2, idx += 2) {
      sessionHash[result[idx] as string] = result[idx + 1] as string;
    }

    // Parse game flat HGETALL array [field1, val1, ...]
    const gameHash: Record<string, string> = {};
    for (; idx < result.length; idx += 2) {
      gameHash[result[idx] as string] = result[idx + 1] as string;
    }

    return {
      status: "action-popped",
      token,
      action,
      timer,
      gameHash,
      sessionHash,
    };
  }

  /**
   * Check if game has active action lock.
   */
  public async isLocked(gameId: string): Promise<boolean> {
    const lockKey = this.getLockKey(gameId);
    const exists = await this.redisService.get(lockKey);
    return exists !== null;
  }
}
