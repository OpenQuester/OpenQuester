import { singleton } from "tsyringe";

import { REDIS_CACHE_DEFAULT_KEY_EXPIRE } from "domain/constants/cache";
import { ICache } from "domain/types/cache/ICache";
import { ValueUtils } from "domain/utils/ValueUtils";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";

/**
 * Cache implementation using Redis.
 * Provides get/set/delete with TTL support.
 */
@singleton()
export class RedisCache implements ICache {
  constructor(private readonly redisRepository: RedisRepository) {
    //
  }

  /**
   * Scan for keys matching a pattern. Returns array of keys.
   * @param pattern Redis key pattern, e.g. "cache:user:*:1"
   */
  public async scan(pattern: string): Promise<string[]> {
    return this.redisRepository.scan(pattern);
  }

  public async get<T>(key: string): Promise<T | null> {
    const val = await this.redisRepository.get(key);

    if (!val) {
      return null;
    }

    if (ValueUtils.isObject(val)) {
      return val;
    }

    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }

  // TODO: Implement cache for user list and packages list using query params normalization + hashing
  // * so we collect all query params, sort them in same order always no matter how we got them, and then hash the resulting string to get a fixed length key part
  // * also we add missing query params keys to the string with empty value always, so that we don't have cache misses for same queries with missing optional params
  public async set<T>(key: string, value: T, ttlMilliseconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    return this.redisRepository.set(
      key,
      serialized,
      ttlMilliseconds ?? REDIS_CACHE_DEFAULT_KEY_EXPIRE
    );
  }

  public async delete(key: string): Promise<void> {
    await this.redisRepository.del(key);
  }
}
