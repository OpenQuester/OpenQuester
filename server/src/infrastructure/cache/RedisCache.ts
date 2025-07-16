import { REDIS_CACHE_DEFAULT_KEY_EXPIRE } from "domain/constants/cache";
import { ICache } from "domain/types/cache/ICache";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class RedisCache implements ICache {
  constructor(private readonly redisService: RedisService) {
    //
  }

  /**
   * Scan for keys matching a pattern. Returns array of keys.
   * @param pattern Redis key pattern, e.g. "cache:user:*:1"
   */
  public async scan(pattern: string): Promise<string[]> {
    return this.redisService.scan(pattern);
  }

  public async get<T>(key: string): Promise<T | null> {
    const val = await this.redisService.get(key);

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

  public async set<T>(
    key: string,
    value: T,
    ttlMilliseconds?: number
  ): Promise<void> {
    const serialized = JSON.stringify(value);

    return this.redisService.set(
      key,
      serialized,
      ttlMilliseconds ?? REDIS_CACHE_DEFAULT_KEY_EXPIRE
    );
  }

  public async delete(key: string): Promise<void> {
    await this.redisService.del(key);
  }
}
