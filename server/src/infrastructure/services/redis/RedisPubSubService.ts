import { REDIS_KEY_EXPIRE_EVENT } from "domain/constants/redis";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { Logger } from "infrastructure/utils/Logger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class RedisPubSubService {
  constructor(
    private readonly redisService: RedisService,
    private readonly handlers: RedisExpirationHandler[]
  ) {
    //
  }

  public async initKeyExpirationHandling() {
    await this.redisService.subscribe(REDIS_KEY_EXPIRE_EVENT);

    this.redisService.on("message", async (ch, message) => {
      if (!ValueUtils.isString(message)) return;

      Logger.debug(`Key expired: ${ch} - ${message}`);

      for (const handler of this.handlers) {
        if (handler.supports(message)) {
          await handler.handle(message);
          break;
        }
      }
    });

    Logger.info("Redis subscribed for keys expiration");
  }
}
