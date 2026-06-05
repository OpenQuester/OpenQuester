import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { GameService } from "application/services/game/GameService";
import {
  GAME_EXPIRATION_WARNING_NAMESPACE,
  GAME_EXPIRATION_WARNING_SECONDS
} from "domain/constants/game";
import { SECOND_MS } from "domain/constants/time";
import { REDIS_LOCK_GAME_EXPIRATION_WARNING } from "domain/constants/redis";
import { NotificationType } from "domain/enums/NotificationType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import {
  GameExpirationWarningNotificationData,
  NotificationBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { RedisService } from "application/services/redis/RedisService";

/**
 * Handles game expiration warning events from Redis.
 */
@singleton()
export class GameExpirationNotificationHandler implements RedisExpirationHandler {
  constructor(
    private readonly gameService: GameService,
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
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
        error: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    const payload: NotificationBroadcastData<GameExpirationWarningNotificationData> = {
      type: NotificationType.GAME_EXPIRATION_WARNING,
      data: {
        gameId,
        expiresAt: new Date(Date.now() + GAME_EXPIRATION_WARNING_SECONDS * SECOND_MS)
      }
    };

    this.realtimeGateway.publish(
      RealtimeEvents.toRoom(gameId, SocketIOEvents.NOTIFICATIONS, payload)
    );

    this.logger.info("Game expiration warning sent", {
      prefix: LogPrefix.NOTIFICATION,
      gameId,
      warningSeconds: GAME_EXPIRATION_WARNING_SECONDS
    });
  }
}
