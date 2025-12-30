import Redis, { Callback, RedisKey, RedisValue } from "ioredis";

import { REDIS_LOCK_KEY_EXPIRE_DEFAULT } from "domain/constants/redis";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { ILogger } from "infrastructure/logger/ILogger";
import {
  RedisLogSanitizer,
  type RedisLogData,
} from "infrastructure/utils/RedisLogSanitizer";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class RedisRepository {
  private _client: Redis;
  private _subClient: Redis;

  constructor(private readonly logger: ILogger) {
    this._client = RedisConfig.getClient();
    this._subClient = RedisConfig.getSubClient();
  }

  /**
   * Subscribe to Redis pub/sub channel
   * 
   * Purpose: Infrastructure operation - no logging needed unless it fails
   */
  public async subscribe(channel: string, callback?: Callback<unknown>) {
    if (callback) {
      return this._subClient.subscribe(channel, callback);
    } else {
      return this._subClient.subscribe(channel);
    }
  }

  public on(
    event: string,
    callback: (channel: string, message: string) => void
  ) {
    return this._subClient.on(event, callback);
  }

  public off(
    event: string,
    callback: (channel: string, message: string) => void
  ) {
    return this._subClient.off(event, callback);
  }

  public async unsubscribe(channel: string): Promise<void> {
    await this._subClient.unsubscribe(channel);
  }

  public async setLockKey(lockValue: string, expire?: number) {
    return this._client.set(
      lockValue,
      "1",
      "EX",
      expire ?? REDIS_LOCK_KEY_EXPIRE_DEFAULT,
      "NX"
    );
  }

  public async publish(channel: string, message: string) {
    return this._client.publish(channel, message);
  }

  /**
   * Sanitizes log data for Redis operations using the dedicated sanitization service
   */
  private sanitizeLogData<T extends RedisLogData>(data: T): T {
    return RedisLogSanitizer.sanitize(data);
  }

  /**
   * Private wrapper method to handle consistent logging for Redis operations
   * 
   * Purpose: Answer "How long did this Redis operation take?"
   * Level: performance (database/external call timing)
   * Note: Removed trace logs - implementation details not useful for diagnosis
   * 
   * @param operationName The name of the Redis operation (e.g., "Redis GET")
   * @param traceLogData Object containing data to log
   * @param operation The async Redis operation to execute
   * @returns The result of the Redis operation
   */
  private async executeWithLogging<T>(
    operationName: string,
    traceLogData: RedisLogData,
    operation: () => Promise<T>,
    performanceLogData: RedisLogData | null = null
  ): Promise<T> {
    const sanitizedPerformanceData = performanceLogData
      ? this.sanitizeLogData(performanceLogData)
      : this.sanitizeLogData(traceLogData);

    const log = this.logger.performance(
      operationName,
      sanitizedPerformanceData
    );

    try {
      const result = await operation();
      return result;
    } finally {
      log.finish();
    }
  }

  /**
   * @param key storing key. Example of key with namespace: "cache:users:1"
   * @param expire expire time in milliseconds
   */
  public async set(key: string, value: string, expire?: number): Promise<void> {
    return this.executeWithLogging(
      "Redis SET",
      { key, value, expire: expire ?? null },
      async () => {
        if (expire) {
          await this._client.set(key, value, "PX", expire);
        } else {
          await this._client.set(key, value);
        }
      },
      { key, expire: expire ?? null }
    );
  }

  /**
   * Retrieves all keys matching a pattern using Redis SCAN.
   * @param pattern The pattern to match (e.g., "game:*").
   * @returns An array of matching keys.
   */
  public async scan(pattern: string): Promise<string[]> {
    return this.executeWithLogging("Redis SCAN", { pattern }, async () => {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const reply = await this._client.scan(
          cursor.toString(),
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = reply[0]?.toString() ?? "0";

        const keysReply = reply[1];

        // Ignore index keys
        const filtered = keysReply.filter((key) => !key.includes("index"));

        keys.push(...filtered);
      } while (cursor !== "0");

      return keys;
    });
  }

  /**
   * Deletes multiple keys from Redis.
   */
  public async delMultiple(keys: string[]): Promise<number> {
    return this.executeWithLogging(
      "Redis DEL multiple",
      { keys: keys.length },
      async () => {
        if (keys.length === 0) return 0;
        return this._client.unlink(...keys);
      }
    );
  }

  /**
   * Cleanup Redis keys by pattern
   * 
   * Purpose: Answer "How many keys were cleaned up?"
   * Level: info (cleanup outcome), performance (operation timing), error (failures)
   * 
   * @param keyPattern Key pattern to cleanup, for example `game:*`
   * @param logEntity Log entity for correct logs, for example "game"
   */
  public async cleanupKeys(
    keyPattern: string,
    logEntity: string
  ): Promise<void> {
    const log = this.logger.performance(`Redis cleanup`, {
      keyPattern,
      logEntity,
    });

    try {
      const keys = await this.scan(keyPattern);
      if (keys.length > 0) {
        await this.delMultiple(keys);

        this.logger.info(`Redis keys cleaned up`, {
          prefix: "[REDIS]: ",
          entity: logEntity,
          count: keys.length,
        });
      }
    } catch (err: any) {
      this.logger.error(`Redis cleanup failed`, {
        prefix: "[REDIS]: ",
        entity: logEntity,
        error: err.message,
      });
    } finally {
      log.finish();
    }
  }

  public async hgetall(
    key: string,
    updateTtl?: number
  ): Promise<Record<string, string>> {
    return this.executeWithLogging(
      "Redis HGETALL",
      { key, updateTtl: updateTtl ?? null },
      async () => {
        const values = await this._client.hgetall(key);
        if (updateTtl && values !== null && !ValueUtils.isEmpty(values)) {
          await this.expire(key, updateTtl);
        }
        return values;
      }
    );
  }

  public async hget(
    key: string,
    field: string,
    updateTtl?: number
  ): Promise<string | null> {
    return this.executeWithLogging(
      "Redis HGET",
      { key, field, updateTtl: updateTtl ?? null },
      async () => {
        const value = await this._client.hget(key, field);
        if (updateTtl && value !== null && !ValueUtils.isEmpty(value)) {
          await this.expire(key, updateTtl);
        }
        return value;
      }
    );
  }

  public async get(key: string, updateTtl?: number): Promise<string | null> {
    return this.executeWithLogging(
      "Redis GET",
      { key, updateTtl: updateTtl ?? null },
      async () => {
        const value = await this._client.get(key);

        if (updateTtl && value !== null && !ValueUtils.isEmpty(value)) {
          await this.expire(key, updateTtl);
        }

        return value;
      }
    );
  }

  public async hset(
    key: string,
    fields: Record<string, string>,
    expire?: number
  ): Promise<number> {
    return this.executeWithLogging(
      "Redis HSET",
      { key, fields, expire },
      async () => {
        if (expire) {
          const pipeline = this._client.pipeline();
          pipeline.hset(key, fields);
          pipeline.expire(key, expire);
          const results = await pipeline.exec();

          if (!results) {
            return -1;
          }

          for (const [err] of results) {
            if (err) {
              throw err;
            }
          }

          return results[0][1] as number;
        } else {
          return this._client.hset(key, fields);
        }
      },
      { key, expire }
    );
  }

  /**
   * Set a key's time to live in seconds
   */
  public async expire(key: string, ttl: number): Promise<number> {
    return this.executeWithLogging("Redis EXPIRE", { key, ttl }, async () => {
      return this._client.expire(key, ttl);
    });
  }

  public pipeline() {
    return this._client.pipeline();
  }

  public async del(key: string): Promise<number> {
    return this.executeWithLogging("Redis DEL", { key }, async () => {
      return this._client.del(key);
    });
  }

  // List operations for action queue
  public async rpush(key: string, value: string): Promise<number> {
    return this.executeWithLogging("Redis RPUSH", { key }, async () => {
      return this._client.rpush(key, value);
    });
  }

  public async lpop(key: string): Promise<string | null> {
    return this.executeWithLogging("Redis LPOP", { key }, async () => {
      return this._client.lpop(key);
    });
  }

  public async lindex(key: string, index: number): Promise<string | null> {
    return this.executeWithLogging("Redis LINDEX", { key, index }, async () => {
      return this._client.lindex(key, index);
    });
  }

  public async llen(key: string): Promise<number> {
    return this.executeWithLogging("Redis LLEN", { key }, async () => {
      return this._client.llen(key);
    });
  }

  public async zrem(key: string, members: string[]) {
    return this.executeWithLogging("Redis ZREM", { key, members }, async () => {
      return this._client.zrem(key, members);
    });
  }

  public async srem(key: string, members: string) {
    return this.executeWithLogging("Redis SREM", { key, members }, async () => {
      return this._client.srem(key, members);
    });
  }

  public async zunionstore(
    destination: string,
    numKeys: number | string,
    keys: string[]
  ) {
    return this.executeWithLogging(
      "Redis ZUNIONSTORE",
      { destination, numKeys, keys },
      async () => {
        return this._client.zunionstore(destination, numKeys, keys);
      }
    );
  }

  public async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ) {
    return this.executeWithLogging(
      "Redis ZREMRANGEBYSCORE",
      { key, min, max },
      async () => {
        return this._client.zremrangebyscore(key, min, max);
      }
    );
  }

  public async zinterstore(
    destination: string,
    numKeys: number,
    keys: (RedisKey | RedisValue)[]
  ) {
    return this.executeWithLogging(
      "Redis ZINTERSTORE",
      { destination, numKeys, keys },
      async () => {
        return this._client.zinterstore(destination, numKeys, ...keys);
      }
    );
  }

  public async zrangebylex(key: string, min: string, max: string) {
    return this.executeWithLogging(
      "Redis ZRANGEBYLEX",
      { key, min, max },
      async () => {
        return this._client.zrangebylex(key, min, max);
      }
    );
  }

  public async sadd(key: string, members: string[]) {
    return this.executeWithLogging("Redis SADD", { key, members }, async () => {
      return this._client.sadd(key, members);
    });
  }

  public async zadd(key: string, scoreMembers: RedisValue[]) {
    return this.executeWithLogging(
      "Redis ZADD",
      { key, scoreMembers },
      async () => {
        return this._client.zadd(key, ...scoreMembers);
      }
    );
  }

  public async zcard(key: string) {
    return this.executeWithLogging("Redis ZCARD", { key }, async () => {
      return this._client.zcard(key);
    });
  }

  public async zrevrange(key: string, start: number, stop: number) {
    return this.executeWithLogging(
      "Redis ZREVRANGE",
      { key, start, stop },
      async () => {
        return this._client.zrevrange(key, start, stop);
      }
    );
  }

  public async zrange(key: string, start: number, stop: number) {
    return this.executeWithLogging(
      "Redis ZRANGE",
      { key, start, stop },
      async () => {
        return this._client.zrange(key, start, stop);
      }
    );
  }

  public async zScanMatch(
    key: string,
    cursor: number | string,
    pattern: string
  ) {
    return this.executeWithLogging(
      "Redis ZSCAN MATCH",
      { key, cursor, pattern },
      async () => {
        return this._client.zscan(key, cursor, "MATCH", pattern);
      }
    );
  }

  public async zScanCount(
    key: string,
    cursor: number | string,
    count: number | string
  ) {
    return this.executeWithLogging(
      "Redis ZSCAN COUNT",
      { key, cursor, count },
      async () => {
        return this._client.zscan(key, cursor, "COUNT", count);
      }
    );
  }
}
