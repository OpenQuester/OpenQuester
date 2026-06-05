import { RedisConfig } from "shared/config/RedisConfig";
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

    if (this.redisClient.status !== "ready" && this.redisClient.status !== "connecting") {
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
    // Don't throw - tests should not fail due to clean up issues (unless game id race condition happens)
    const remainingKeys = await client.keys("*");
    if (remainingKeys.length > 0) {
      console.warn(
        `[REDIS_CLEANUP]: Warning - ${
          remainingKeys.length
        } keys remain after ${maxAttempts} cleanup attempts: ${remainingKeys.join(", ")}`
      );
    }
  }
}
