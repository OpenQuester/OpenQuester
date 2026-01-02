import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { Namespace, Server } from "socket.io";

type IOEvent = SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;

/**
 * Broadcast service for emitting events across server instances.
 *
 * Uses Socket.IO's io.to() which works cross-instance with Redis adapter.
 * This service is used by GameActionExecutor to emit results/errors
 * to the original socket that submitted an action, regardless of which
 * server instance processes the action.
 */
export class GameActionBroadcastService {
  private _io?: Namespace | Server;
  private _gameService?: SocketIOGameService;

  constructor(private readonly logger: ILogger) {}

  /**
   * Initialize with Socket.IO server/namespace and game service.
   * Must be called before using emit methods.
   */
  public init(io: Namespace | Server, gameService?: SocketIOGameService): void {
    this._io = io;
    this._gameService = gameService;
  }

  private get io(): Namespace | Server {
    if (!this._io) {
      throw new Error("GameActionBroadcastService not initialized");
    }
    return this._io;
  }

  /**
   * Emit error to original socket that submitted the action.
   * Works cross-instance via Redis adapter.
   */
  public emitError(socketId: string, message: string): void {
    try {
      this.io.to(socketId).emit(SocketIOEvents.ERROR, {
        message,
      } satisfies ErrorEventPayload);
    } catch (error) {
      // Socket might have disconnected, log but don't throw
      this.logger.debug(
        `Failed to emit error to socket ${socketId}: ${error}`,
        { prefix: LogPrefix.ACTION_BROADCAST }
      );
    }
  }

  /**
   * Emit broadcasts from action handler result.
   */
  public async emitBroadcasts(
    broadcasts: SocketEventBroadcast[],
    defaultGameId?: string
  ): Promise<void> {
    for (const broadcast of broadcasts) {
      const gameId = broadcast.gameId ?? defaultGameId;

      switch (broadcast.target) {
        case SocketBroadcastTarget.SOCKET:
          // Emit directly to specific socket if socketId provided
          if (broadcast.socketId) {
            this.io
              .to(broadcast.socketId)
              .emit(broadcast.event, broadcast.data);
          } else if (gameId) {
            // Fallback to game room (socket should be in room)
            this.io.to(gameId).emit(broadcast.event, broadcast.data);
          }
          break;

        case SocketBroadcastTarget.GAME:
          if (gameId) {
            // Handle role-based broadcasts
            if (broadcast.useRoleBasedBroadcast) {
              await this.emitWithRoleBasedFiltering(
                broadcast.event,
                broadcast.data as { gameState: GameStateDTO },
                gameId
              );
            } else {
              this.io.to(gameId).emit(broadcast.event, broadcast.data);
            }
          }
          break;

        case SocketBroadcastTarget.ALL:
        default:
          this.io.emit(broadcast.event, broadcast.data);
          break;
      }
    }
  }

  /**
   * Emit to a specific socket.
   * Works cross-instance via Redis adapter.
   */
  public emitToSocket<T>(event: IOEvent, data: T, socketId: string): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Emit to a game room.
   */
  public emitToGame<T>(event: IOEvent, data: T, gameId: string): void {
    this.io.to(gameId).emit(event, data);
  }

  /**
   * Role-based filtering emit for game state broadcasts.
   * Sends filtered game state to each player based on their role.
   */
  private async emitWithRoleBasedFiltering(
    event: IOEvent,
    data: { gameState: GameStateDTO },
    gameId: string
  ): Promise<void> {
    if (!this._gameService) {
      // Fallback to regular emit if game service not available
      this.logger.warn(
        "Role-based filtering not available - game service not initialized",
        { prefix: LogPrefix.BROADCAST }
      );
      this.io.to(gameId).emit(event, data);
      return;
    }

    try {
      // Get all socket IDs in the game room
      const sockets = await this.io.in(gameId).fetchSockets();
      const socketIds = sockets.map((socket) => socket.id);

      // Use the game service to get the broadcast map
      const broadcastMap = await this._gameService.getGameStateBroadcastMap(
        socketIds,
        gameId,
        data.gameState
      );

      // Emit to each socket with the appropriate filtered data
      for (const [socketId, gameState] of broadcastMap.entries()) {
        const customData = { ...data, gameState };
        this.io.to(socketId).emit(event, customData);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error in role-based filtering emit: ${JSON.stringify(error)}`,
        { prefix: LogPrefix.BROADCAST }
      );
      // Fallback to regular room emit if role-based filtering fails
      this.io.to(gameId).emit(event, data);
    }
  }
}
