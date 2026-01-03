import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { USER_CACHE_KEY, USER_CACHE_KEY_TTL } from "domain/constants/cache";
import { ICache } from "domain/types/cache/ICache";
import { SelectOptions } from "domain/types/SelectOptions";
import { User } from "infrastructure/database/models/User";

/**
 * Use case for caching user data.
 * Uses ICache interface for SOLID DIP compliance - implementation (RedisCache)
 * is injected via DI token.
 */
@singleton()
export class UserCacheUseCase {
  constructor(@inject(DI_TOKENS.Cache) private readonly cache: ICache) {
    //
  }

  /**
   * Get user from cache for specific select options
   */
  public async get(userId: number, selectOptions: SelectOptions<User>) {
    return this.cache.get<User>(this._getCacheKey(userId, selectOptions));
  }

  /**
   * Set user in cache for specific select options
   */
  public async set(user: User, selectOptions: SelectOptions<User>) {
    return this.cache.set<User>(
      this._getCacheKey(user.id, selectOptions),
      user,
      USER_CACHE_KEY_TTL
    );
  }

  /**
   * Delete user cache for specific select options or all for userId if not provided
   */
  public async delete(userId: number, selectOptions?: SelectOptions<User>) {
    if (selectOptions) {
      // Delete specific cache entry
      return this.cache.delete(this._getCacheKey(userId, selectOptions));
    }
    // Delete all cache entries for this userId (requires scan support)
    const pattern = `${USER_CACHE_KEY}:*:${userId}`;
    const keys = await this.cache.scan(pattern);
    for (const key of keys) {
      await this.cache.delete(key);
    }
  }

  private _getCacheKey(
    userId: number,
    selectOptions: SelectOptions<User>
  ): string {
    // select: comma-separated fields, e.g. "id,username"
    const select = [...(selectOptions.select || [])].sort().join(",");
    // relations: comma-separated, e.g. "avatar,permissions"
    const relations = [...(selectOptions.relations || [])].sort().join(",");
    // relationSelects: key:field1|field2, e.g. "avatar:id|filename"
    let relationSelects = "";
    if (selectOptions.relationSelects) {
      const relKeys = Object.keys(selectOptions.relationSelects).sort();
      relationSelects = relKeys
        .map((key) => {
          const fields = (
            selectOptions.relationSelects?.[key as keyof User] || []
          )
            .slice()
            .sort()
            .join("|");
          return `${key}:${fields}`;
        })
        .join(",");
    }
    // Compose the key
    // Example: cache:user:select-id,username:relations-avatar:relselects-avatar:id|filename:1
    return `${USER_CACHE_KEY}:select-${select}:relations-${relations}:relselects-${relationSelects}:${userId}`;
  }
}
