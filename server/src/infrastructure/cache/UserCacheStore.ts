import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { USER_CACHE_KEY, USER_CACHE_KEY_TTL } from "domain/constants/cache";
import { ICache } from "domain/types/cache/ICache";
import { SelectOptions } from "domain/types/SelectOptions";
import { User } from "infrastructure/database/models/User";

/**
 * Stores user query results in cache by selected fields and relations.
 */
@singleton()
export class UserCacheStore {
  constructor(@inject(DI_TOKENS.Cache) private readonly cache: ICache) {
    //
  }

  public async get(userId: number, selectOptions: SelectOptions<User>): Promise<User | null> {
    return this.cache.get<User>(this._getCacheKey(userId, selectOptions));
  }

  public async set(user: User, selectOptions: SelectOptions<User>): Promise<void> {
    return this.cache.set<User>(
      this._getCacheKey(user.id, selectOptions),
      user,
      USER_CACHE_KEY_TTL
    );
  }

  public async delete(userId: number, selectOptions?: SelectOptions<User>): Promise<void> {
    if (selectOptions) {
      return this.cache.delete(this._getCacheKey(userId, selectOptions));
    }

    const pattern = `${USER_CACHE_KEY}:*:${userId}`;
    const keys = await this.cache.scan(pattern);
    await Promise.all(keys.map((key) => this.cache.delete(key)));
  }

  private _getCacheKey(userId: number, selectOptions: SelectOptions<User>): string {
    const select = [...(selectOptions.select || [])].sort().join(",");
    const relations = [...(selectOptions.relations || [])].sort().join(",");
    let relationSelects = "";

    if (selectOptions.relationSelects) {
      const relKeys = Object.keys(selectOptions.relationSelects).sort();
      relationSelects = relKeys
        .map((key) => {
          const fields = (selectOptions.relationSelects?.[key as keyof User] || [])
            .slice()
            .sort()
            .join("|");
          return `${key}:${fields}`;
        })
        .join(",");
    }

    return `${USER_CACHE_KEY}:select-${select}:relations-${relations}:relselects-${relationSelects}:${userId}`;
  }
}
