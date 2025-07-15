import { REDIS_KEY_EXPIRE_EVENT } from "domain/constants/redis";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class RedisPubSubService {
  constructor(
    private readonly redisService: RedisService,
    private readonly handlers: RedisExpirationHandler[],
    private readonly logger: ILogger
  ) {
    //
  }

  public async initKeyExpirationHandling() {
    await this.redisService.subscribe(
      REDIS_KEY_EXPIRE_EVENT(
        Environment.getInstance(this.logger).REDIS_DB_NUMBER
      )
    );

    this.redisService.on("message", async (_, message) => {
      if (!ValueUtils.isString(message)) return;

      this.logger.debug(`Key expired: ${message}`, {
        prefix: "[RedisPubSubService]: ",
      });

      for (const handler of this.handlers) {
        if (handler.supports(message)) {
          await handler.handle(message);
          break;
        }
      }
    });

    this.logger.info("Redis subscribed for keys expiration", {
      prefix: "[RedisPubSubService]: ",
    });
  }
}
