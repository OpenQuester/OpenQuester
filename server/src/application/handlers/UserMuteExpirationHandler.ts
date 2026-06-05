import { inject, singleton } from "tsyringe";

import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { SOCKET_USER_MUTE_PREFIX } from "domain/constants/socket";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { DI_TOKENS } from "shared/di/tokens";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Clears active socket mute state when the Redis mute-expiry marker expires.
 */
@singleton()
export class UserMuteExpirationHandler implements RedisExpirationHandler {
  constructor(
    private readonly socketUserDataService: SocketUserDataService,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${SOCKET_USER_MUTE_PREFIX}:`);
  }

  public async handle(key: string): Promise<void> {
    const rawUserId = key.slice(SOCKET_USER_MUTE_PREFIX.length + 1);
    const userId = Number(rawUserId);

    if (!Number.isInteger(userId)) {
      this.logger.warn("Invalid user mute expiration key", {
        prefix: LogPrefix.REDIS,
        key
      });
      return;
    }

    const socketId = await this.socketUserDataService.findSocketIdByUserId(userId);
    if (!socketId) {
      return;
    }

    await this.socketUserDataService.update(socketId, { mutedUntil: null });
    this.realtimeGateway.updateSocketContext({ socketId, mutedUntil: null });
  }
}
