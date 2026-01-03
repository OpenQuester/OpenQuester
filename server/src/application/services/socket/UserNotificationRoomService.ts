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
    const socket = this.gamesNsp.sockets.get(socketId);

    if (!socket) {
      this.logger.error(
        `Socket ${socketId} not found when subscribing to user ${userId} notifications (likely disconnected)`,
        { prefix: LogPrefix.NOTIFICATION }
      );
      return;
    }

    await socket.join(roomName);
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
    const socket = this.gamesNsp.sockets.get(socketId);

    if (!socket) {
      this.logger.error(
        `Socket ${socketId} not found when unsubscribing from user ${userId} notifications (likely disconnected)`,
        { prefix: LogPrefix.NOTIFICATION }
      );
      return;
    }

    await socket.leave(roomName);
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

    // Get all sockets in the game room and make them join the user notification room
    const gameRoom = this.gamesNsp.adapter.rooms.get(gameId);
    if (!gameRoom || gameRoom.size === 0) {
      this.logger.error(
        `Game room ${gameId} not found or empty when subscribing to user ${userId} notifications`,
        { prefix: LogPrefix.NOTIFICATION }
      );
      return;
    }

    // Use socketsJoin to add all sockets in the game room to the user notification room
    this.gamesNsp.to(gameId).socketsJoin(userRoom);

    this.logger.trace(
      `All players in game ${gameId} (${gameRoom.size} sockets) subscribed to user ${userId} notifications (room: ${userRoom})`,
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

    // Get all sockets in the game room and make them leave the user notification room
    const gameRoom = this.gamesNsp.adapter.rooms.get(gameId);
    if (!gameRoom) {
      this.logger.error(
        `Game room ${gameId} not found when unsubscribing from user ${userId} notifications`,
        { prefix: LogPrefix.NOTIFICATION }
      );
      return;
    }

    // Use socketsLeave to remove all sockets in the game room from the user notification room
    this.gamesNsp.to(gameId).socketsLeave(userRoom);

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

    // Debug: Check if there are any sockets in the room
    const room = this.gamesNsp.adapter.rooms.get(roomName);
    const socketsInRoom = room ? room.size : 0;

    this.logger.debug(
      `Emitted user change event for user ${userData.id} to room ${roomName} (${socketsInRoom} sockets)`,
      { prefix: LogPrefix.NOTIFICATION }
    );
  }
}
