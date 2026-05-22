import { Callback } from "ioredis";
import { singleton } from "tsyringe";

import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";

/**
 * Service layer for Redis operations.
 * Wraps RedisRepository with business-friendly methods.
 */
@singleton()
export class RedisService {
  constructor(private readonly redisRepository: RedisRepository) {
    //
  }

  public async subscribe(channel: string, callback?: Callback<unknown>) {
    return this.redisRepository.subscribe(channel, callback);
  }

  public on(event: string, callback: (channel: string, message: string) => void) {
    return this.redisRepository.on(event, callback);
  }

  public off(event: string, callback: (channel: string, message: string) => void) {
    return this.redisRepository.off(event, callback);
  }

  public async unsubscribe(channel: string): Promise<void> {
    return this.redisRepository.unsubscribe(channel);
  }

  public async setLockKey(lockKey: string, expire?: number, value?: string) {
    return this.redisRepository.setLockKey(lockKey, expire, value);
  }

  /**
   * @param key storing key. Example of key with namespace: "cache:users:1"
   * @param value storing value
   * @param expire expire time in milliseconds
   */
  public async set(key: string, value: string, expire?: number): Promise<void> {
    if (expire) {
      await this.redisRepository.set(key, value, expire);
    } else {
      await this.redisRepository.set(key, value);
    }
  }

  /**
   * Retrieves all keys matching a pattern using Redis SCAN.
   * @param pattern The pattern to match (e.g., "game:*").
   * @returns An array of matching keys.
   */
  public async scan(pattern: string): Promise<string[]> {
    return this.redisRepository.scan(pattern);
  }

  public async get(key: string, updateTtl?: number): Promise<string | null> {
    return this.redisRepository.get(key, updateTtl);
  }

  /**
   * Set a key's time to live in seconds
   */
  public async expire(key: string, ttl: number): Promise<number> {
    return this.redisRepository.expire(key, ttl);
  }

  public pipeline() {
    return this.redisRepository.pipeline();
  }

  public async del(key: string): Promise<number> {
    return this.redisRepository.del(key);
  }

  // List operations for action queue
  public async rpush(key: string, value: string): Promise<number> {
    return this.redisRepository.rpush(key, value);
  }

  public async lindex(key: string, index: number): Promise<string | null> {
    return this.redisRepository.lindex(key, index);
  }

  public async llen(key: string): Promise<number> {
    return this.redisRepository.llen(key);
  }

  public async zcard(key: string) {
    return this.redisRepository.zcard(key);
  }

  /**
   * Execute a Lua script on the Redis server.
   * @param script The Lua script to execute
   * @param numkeys Number of keys in the script
   * @param args Keys followed by arguments
   */
  public async eval(
    script: string,
    numkeys: number,
    ...args: (string | number)[]
  ): Promise<unknown> {
    return this.redisRepository.eval(script, numkeys, ...args);
  }
}
