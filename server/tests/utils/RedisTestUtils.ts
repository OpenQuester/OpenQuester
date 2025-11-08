import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Redis } from "ioredis";

/**
 * Centralized Redis cleanup utilities for tests
 *
 * Ensures consistent and robust cleanup of Redis state between tests.
 * Uses aggressive cleanup strategy - keeps deleting until all keys are gone.
 */
export class RedisTestUtils {
  private static redisClient: Redis;

  /**
   * Get Redis client instance
   */
  private static getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = RedisConfig.getClient();
    }
    return this.redisClient;
  }

  /**
   * Clear all Redis keys with aggressive cleanup strategy
   *
   * Keeps deleting keys until Redis is completely clean.
   * No waiting, no delays - just keep deleting until everything is gone.
   */
  public static async clearAllKeys(): Promise<void> {
    const client = this.getClient();

    // Keep deleting until no keys remain
    let attempts = 0;
    const maxAttempts = 10; // Safety limit to prevent infinite loops

    while (attempts < maxAttempts) {
      const keys = await client.keys("*");

      if (keys.length === 0) {
        // Success - Redis is clean
        return;
      }

      // Delete all found keys
      await client.del(...keys);
      attempts++;
    }

    // This should never happen, but if it does, just log and continue
    // Don't throw - tests should not fail due to cleanup issues (unless game id race condition happens)
    const remainingKeys = await client.keys("*");
    if (remainingKeys.length > 0) {
      console.warn(
        `[REDIS_CLEANUP]: Warning - ${
          remainingKeys.length
        } keys remain after ${maxAttempts} cleanup attempts: ${remainingKeys.join(
          ", "
        )}`
      );
    }
  }

  /**
   * Clear keys matching a specific pattern
   *
   * @param pattern - Redis key pattern (e.g., "game:*", "session:*")
   */
  public static async clearKeysByPattern(pattern: string): Promise<void> {
    const client = this.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  /**
   * Clear all game-related keys
   */
  public static async clearGameKeys(): Promise<void> {
    await this.clearKeysByPattern("game:*");
  }

  /**
   * Clear all action locks
   */
  public static async clearActionLocks(): Promise<void> {
    await this.clearKeysByPattern("game:action:lock:*");
  }

  /**
   * Clear all action queues
   */
  public static async clearActionQueues(): Promise<void> {
    await this.clearKeysByPattern("game:action:queue:*");
  }

  /**
   * Get all current Redis keys (useful for debugging)
   */
  public static async getAllKeys(): Promise<string[]> {
    const client = this.getClient();
    return client.keys("*");
  }

  /**
   * Check if Redis is clean (no keys exist)
   */
  public static async isClean(): Promise<boolean> {
    const keys = await this.getAllKeys();
    return keys.length === 0;
  }

  /**
   * Get count of keys by pattern
   */
  public static async getKeyCount(pattern: string = "*"): Promise<number> {
    const client = this.getClient();
    const keys = await client.keys(pattern);
    return keys.length;
  }

  /**
   * Advanced cleanup with detailed logging
   * Useful for debugging test isolation issues
   */
  public static async clearAllKeysWithLogging(): Promise<void> {
    const client = this.getClient();

    console.log("[REDIS_CLEANUP]: Starting Redis cleanup...");

    const initialKeys = await client.keys("*");
    console.log(
      `[REDIS_CLEANUP]: Found ${initialKeys.length} keys before cleanup`
    );

    if (initialKeys.length > 0) {
      const keysByPrefix = this.groupKeysByPrefix(initialKeys);
      console.log("[REDIS_CLEANUP]: Keys by prefix:", keysByPrefix);
    }

    // Keep cleaning until everything is gone
    await this.clearAllKeys();

    const remainingKeys = await client.keys("*");
    if (remainingKeys.length > 0) {
      console.warn(
        `[REDIS_CLEANUP]: ${remainingKeys.length} keys still remain:`,
        remainingKeys
      );
    } else {
      console.log("[REDIS_CLEANUP]: Cleanup successful - all keys cleared");
    }
  }

  /**
   * Group keys by their prefix for debugging
   */
  private static groupKeysByPrefix(keys: string[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const key of keys) {
      const prefix = key.split(":")[0];
      grouped[prefix] = (grouped[prefix] || 0) + 1;
    }

    return grouped;
  }
}
