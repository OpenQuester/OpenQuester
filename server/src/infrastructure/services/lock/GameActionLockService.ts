import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Redis-based lock service for game action synchronization
 *
 * Purpose: Prevent race conditions by ensuring only one action processes per game at a time
 *
 * Architecture:
 * - Each game has a unique lock key in Redis
 * - Lock automatically expires (TTL=10s) to prevent deadlocks
 * - Used by GameActionExecutor to coordinate action execution
 *
 * Example flow:
 * 1. Action arrives → try acquireLock()
 * 2. If success → process action, releaseLock() when done
 * 3. If failure → action queued in GameActionQueueService
 */
export class GameActionLockService {
  private readonly LOCK_KEY_PREFIX = "game:action:lock";
  private readonly DEFAULT_LOCK_TTL = 10;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: ILogger
  ) {
    //
  }

  private getLockKey(gameId: string): string {
    return `${this.LOCK_KEY_PREFIX}:${gameId}`;
  }

  /**
   * Attempt to acquire lock for game action processing
   * Returns true if lock acquired, false otherwise
   */
  public async acquireLock(
    gameId: string,
    ttl: number = this.DEFAULT_LOCK_TTL
  ): Promise<boolean> {
    const lockKey = this.getLockKey(gameId);
    const acquired = await this.redisService.setLockKey(lockKey, ttl);

    return acquired === "OK";
  }

  /**
   * Release lock for game action processing
   */
  public async releaseLock(gameId: string): Promise<void> {
    const lockKey = this.getLockKey(gameId);
    await this.redisService.del(lockKey);
  }

  /**
   * Check if game has active action lock
   */
  public async isLocked(gameId: string): Promise<boolean> {
    const lockKey = this.getLockKey(gameId);
    const exists = await this.redisService.get(lockKey);
    return exists !== null;
  }
}
