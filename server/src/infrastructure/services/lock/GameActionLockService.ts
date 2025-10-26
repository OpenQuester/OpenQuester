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

    if (acquired === "OK") {
      this.logger.trace(`Action lock acquired for game ${gameId}`, {
        prefix: "[ACTION_LOCK]: ",
        gameId,
        ttl,
      });
      return true;
    }

    this.logger.trace(`Failed to acquire action lock for game ${gameId}`, {
      prefix: "[ACTION_LOCK]: ",
      gameId,
    });
    return false;
  }

  /**
   * Release lock for game action processing
   */
  public async releaseLock(gameId: string): Promise<void> {
    const lockKey = this.getLockKey(gameId);
    await this.redisService.del(lockKey);

    this.logger.trace(`Action lock released for game ${gameId}`, {
      prefix: "[ACTION_LOCK]: ",
      gameId,
    });
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
