import { GAME_NAMESPACE } from "domain/constants/game";
import { REDIS_LOCK_EXPIRATION_KEY } from "domain/constants/redis";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import { RedisService } from "infrastructure/services/redis/RedisService";

export class GameExpirationHandler implements RedisExpirationHandler {
  constructor(
    private readonly gameIndexManager: GameIndexManager,
    private readonly redisService: RedisService
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${GAME_NAMESPACE}:`);
  }

  public async handle(key: string): Promise<void> {
    const lockKey = `${REDIS_LOCK_EXPIRATION_KEY}:${key}`;
    const acquired = await this.redisService.setLockKey(lockKey);

    if (!acquired) {
      return; // Another instance acquired the lock
    }

    const [, gameId] = key.split(":");
    await this.gameIndexManager.removeGameFromAllIndexes(gameId);
  }
}
