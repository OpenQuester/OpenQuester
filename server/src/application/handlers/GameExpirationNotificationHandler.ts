import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import {
  GAME_EXPIRATION_WARNING_NAMESPACE,
  GAME_EXPIRATION_WARNING_SECONDS,
} from "domain/constants/game";
import { REDIS_LOCK_GAME_EXPIRATION_WARNING } from "domain/constants/redis";
import { NotificationType } from "domain/enums/NotificationType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { NotificationBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { Namespace } from "socket.io";

/**
 * Handles game expiration warning events from Redis.
 */
@singleton()
export class GameExpirationNotificationHandler implements RedisExpirationHandler {
  constructor(
    private readonly gameService: GameService,
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.IOGameNamespace) private readonly gamesNsp: Namespace,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${GAME_EXPIRATION_WARNING_NAMESPACE}:`);
  }

  public async handle(key: string): Promise<void> {
    const lockKey = `${REDIS_LOCK_GAME_EXPIRATION_WARNING}:${key}`;
    const acquired = await this.redisService.setLockKey(lockKey);

    if (!acquired) {
      return;
    }

    const [, gameId] = key.split(":");
    if (!gameId) {
      return;
    }

    try {
      const game = await this.gameService.getGameEntity(gameId);
      if (game.finishedAt) {
        return;
      }
    } catch (error) {
      this.logger.warn("Skipping expiration warning for missing game", {
        prefix: LogPrefix.NOTIFICATION,
        gameId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const payload: NotificationBroadcastData = {
      type: NotificationType.GAME_EXPIRATION_WARNING,
      data: {
        gameId,
        expiresAt: new Date(
          Date.now() + GAME_EXPIRATION_WARNING_SECONDS * 1000
        ),
      },
    };

    this.gamesNsp.to(gameId).emit(SocketIOEvents.NOTIFICATIONS, payload);

    this.logger.info("Game expiration warning sent", {
      prefix: LogPrefix.NOTIFICATION,
      gameId,
      warningSeconds: GAME_EXPIRATION_WARNING_SECONDS,
    });
  }
}
