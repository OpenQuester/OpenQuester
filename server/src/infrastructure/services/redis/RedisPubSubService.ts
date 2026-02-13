import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { REDIS_KEY_EXPIRE_EVENT } from "domain/constants/redis";
import { ServerError } from "domain/errors/ServerError";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Service for Redis pub/sub and keyspace notifications.
 * Handles key expiration events for timers, games, etc.
 */
@singleton()
export class RedisPubSubService {
  private _messageHandler: ((channel: string, message: string) => void) | null =
    null;
  private _subscribedChannel: string | null = null;

  constructor(
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.RedisExpirationHandlers)
    private readonly handlers: RedisExpirationHandler[],
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async initKeyExpirationHandling() {
    this._subscribedChannel = REDIS_KEY_EXPIRE_EVENT(
      Environment.getInstance(this.logger).REDIS_DB_NUMBER
    );

    await this.redisService.subscribe(this._subscribedChannel);

    this._messageHandler = async (_, message) => {
      if (!ValueUtils.isString(message)) return;

      this.logger.debug(`Key expired: ${message}`, {
        prefix: LogPrefix.REDIS,
      });

      try {
        for (const handler of this.handlers) {
          if (handler.supports(message)) {
            await handler.handle(message);
            break;
          }
        }
      } catch {
        this.logger.error(
          `Error handling Redis key expiration for key: ${message}`,
          {
            prefix: LogPrefix.REDIS,
          }
        );
        throw new ServerError("Error handling Redis key expiration");
      }
    };

    this.redisService.on("message", this._messageHandler);

    this.logger.info("Redis subscribed for keys expiration", {
      prefix: LogPrefix.REDIS,
    });
  }

  /**
   * Unsubscribe from Redis keyspace notifications and remove the message listener.
   * Should be called during cleanup to prevent stale subscriptions in test environments.
   */
  public async unsubscribe(): Promise<void> {
    if (this._subscribedChannel) {
      await this.redisService.unsubscribe(this._subscribedChannel);
      this._subscribedChannel = null;
    }

    if (this._messageHandler) {
      this.redisService.off("message", this._messageHandler);
      this._messageHandler = null;
    }

    this.logger.info("Redis unsubscribed from keys expiration", {
      prefix: LogPrefix.REDIS,
    });
  }
}
