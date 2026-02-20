import { Namespace } from "socket.io";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { SocketIOUserEvents } from "domain/enums/SocketIOEvents";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { UserChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service for managing user notification rooms.
 * Handles subscription and unsubscription to user change events.
 */
@singleton()
export class UserNotificationRoomService {
  constructor(
    @inject(DI_TOKENS.IOGameNamespace) private readonly gamesNsp: Namespace,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Gets the room name for a user's notification room
   */
  public getUserNotificationRoom(userId: number): string {
    return `user-change-${userId}`;
  }

  /**
   * Subscribe a socket to a user's notification room
   */
  public async subscribeToUserNotifications(
    socketId: string,
    userId: number
  ): Promise<void> {
    const roomName = this.getUserNotificationRoom(userId);

    // Works cross-instance via Redis adapter
    this.gamesNsp.in(socketId).socketsJoin(roomName);

    this.logger.trace(
      `Socket ${socketId} subscribed to user ${userId} notifications (room: ${roomName})`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }

  /**
   * Unsubscribe a socket from a user's notification room
   */
  public async unsubscribeFromUserNotifications(
    socketId: string,
    userId: number
  ): Promise<void> {
    const roomName = this.getUserNotificationRoom(userId);

    // Works cross-instance via Redis adapter
    this.gamesNsp.in(socketId).socketsLeave(roomName);
    this.logger.trace(
      `Socket ${socketId} unsubscribed from user ${userId} notifications (room: ${roomName})`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }

  /**
   * Subscribe all sockets in a game room to a user's notification room
   */
  public async subscribeGameToUserNotifications(
    gameId: string,
    userId: number
  ): Promise<void> {
    const userRoom = this.getUserNotificationRoom(userId);

    // Works cross-instance via Redis adapter — no-op if no sockets are in the game room
    this.gamesNsp.in(gameId).socketsJoin(userRoom);

    this.logger.trace(
      `All players in game ${gameId} subscribed to user ${userId} notifications (room: ${userRoom})`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }

  /**
   * Unsubscribe all sockets in a game room from a user's notification room
   */
  public async unsubscribeGameFromUserNotifications(
    gameId: string,
    userId: number
  ): Promise<void> {
    const userRoom = this.getUserNotificationRoom(userId);

    // Works cross-instance via Redis adapter — no-op if no sockets are in the game room
    this.gamesNsp.in(gameId).socketsLeave(userRoom);

    this.logger.trace(
      `All players in game ${gameId} unsubscribed from user ${userId} notifications (room: ${userRoom})`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }

  /**
   * Subscribe a socket to multiple users' notification rooms (when joining a game)
   */
  public async subscribeToMultipleUserNotifications(
    socketId: string,
    userIds: number[]
  ): Promise<void> {
    for (const userId of userIds) {
      await this.subscribeToUserNotifications(socketId, userId);
    }
  }

  /**
   * Unsubscribe a socket from multiple users' notification rooms (when leaving a game)
   */
  public async unsubscribeFromMultipleUserNotifications(
    socketId: string,
    userIds: number[]
  ): Promise<void> {
    for (const userId of userIds) {
      await this.unsubscribeFromUserNotifications(socketId, userId);
    }
  }

  /**
   * Emit a user change event to all subscribers
   */
  public emitUserChange(userData: UserDTO): void {
    const roomName = this.getUserNotificationRoom(userData.id);

    this.gamesNsp.to(roomName).emit(SocketIOUserEvents.USER_CHANGE, {
      userData,
    } satisfies UserChangeBroadcastData);

    // Debug: Check local socket count in the room (may undercount in multi-instance)
    const room = this.gamesNsp.adapter.rooms.get(roomName);
    const localSocketsInRoom = room ? room.size : 0;

    this.logger.debug(
      `Emitted user change event for user ${userData.id} to room ${roomName} (${localSocketsInRoom} local sockets)`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }
}
