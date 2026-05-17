import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents
} from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

type IOEvent = SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;

/**
 * Broadcast service for emitting events across server instances.
 *
 * Uses Socket.IO's io.to() which works cross-instance with Redis adapter.
 * This service is used by GameActionExecutor to emit results/errors
 * to the original socket that submitted an action, regardless of which
 * server instance processes the action.
 */
@singleton()
export class GameActionBroadcastService {
  constructor(
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    private readonly questionService: SocketIOQuestionService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Emit error to original socket that submitted the action.
   * Works cross-instance via Redis adapter.
   */
  public emitError(socketId: string, message: string): void {
    try {
      void this.realtimeGateway.publish(
        RealtimeEvents.toSocket(socketId, SocketIOEvents.ERROR, {
          message
        } satisfies ErrorEventPayload)
      );
    } catch (error) {
      // Socket might have disconnected, log but don't throw
      this.logger.debug(`Failed to emit error to socket ${socketId}: ${error}`, {
        prefix: LogPrefix.ACTION_BROADCAST
      });
    }
  }

  /**
   * Emit broadcasts from action handler result.
   * @param broadcasts The broadcasts to emit
   * @param game Game entity for targeting
   */
  public async emitBroadcasts(broadcasts: SocketEventBroadcast[], game: Game): Promise<void> {
    for (const broadcast of broadcasts) {
      const gameId = broadcast.gameId ?? game.id;

      switch (broadcast.target) {
        case SocketBroadcastTarget.SOCKET:
          // Emit directly to specific socket if socketId provided
          if (broadcast.socketId) {
            this.realtimeGateway.publish(
              RealtimeEvents.toSocket(broadcast.socketId, broadcast.event, broadcast.data)
            );
          } else if (gameId) {
            // Fallback to game room (socket should be in room)
            this.realtimeGateway.publish(
              RealtimeEvents.toRoom(gameId, broadcast.event, broadcast.data)
            );
          }
          break;

        case SocketBroadcastTarget.GAME:
          if (gameId) {
            // Handle role-based broadcasts
            if (broadcast.useRoleBasedBroadcast) {
              await this.emitWithRoleBasedFiltering(broadcast.event, game);
            } else {
              this.realtimeGateway.publish(
                RealtimeEvents.toRoom(gameId, broadcast.event, broadcast.data)
              );
            }
          }
          break;

        case SocketBroadcastTarget.ALL:
        default:
          this.realtimeGateway.publish(RealtimeEvents.toAll(broadcast.event, broadcast.data));
          break;
      }
    }
  }

  /**
   * Role-based filtering emit for game state broadcasts.
   * Sends filtered game state to each player based on their role.
   */
  private async emitWithRoleBasedFiltering(event: IOEvent, game: Game): Promise<void> {
    try {
      // Get all socket IDs in the game room
      const socketIds = await this.realtimeGateway.getRoomSocketIds(game.id);

      // With the Redis adapter, fetchSockets() may return an empty array
      // in single-instance environments (e.g. tests) because it queries
      // remote instances via pub/sub instead of local in-memory rooms.
      // Fall back to a plain room broadcast to guarantee delivery.
      if (socketIds.length === 0) {
        this.realtimeGateway.publish(
          RealtimeEvents.toRoom(game.id, event, { gameState: game.gameState })
        );
        return;
      }

      // Use the question service to get the broadcast map
      const broadcastMap = await this.questionService.getGameStateBroadcastMap(socketIds, game);

      // If the map is empty (all sessions missing), fall back to room broadcast
      if (broadcastMap.size === 0) {
        this.realtimeGateway.publish(
          RealtimeEvents.toRoom(game.id, event, { gameState: game.gameState })
        );
        return;
      }

      // Emit to each socket with the appropriate filtered data
      for (const [socketId, gameState] of broadcastMap.entries()) {
        this.realtimeGateway.publish(RealtimeEvents.toSocket(socketId, event, { gameState }));
      }
    } catch (error: unknown) {
      this.logger.error(`Error in role-based filtering emit: ${JSON.stringify(error)}`, {
        prefix: LogPrefix.BROADCAST
      });
      // Fallback to regular room emit if role-based filtering fails
      this.realtimeGateway.publish(
        RealtimeEvents.toRoom(game.id, event, { gameState: game.gameState })
      );
    }
  }
}
