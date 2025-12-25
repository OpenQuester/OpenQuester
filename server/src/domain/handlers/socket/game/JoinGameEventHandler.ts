import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  GameJoinInputData,
  GameJoinOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class JoinGameEventHandler extends BaseSocketEventHandler<
  GameJoinInputData,
  GameJoinOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly userNotificationRoomService: UserNotificationRoomService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.JOIN;
  }

  protected override async getGameIdForAction(
    data: GameJoinInputData,
    _context: SocketEventContext
  ): Promise<string | null> {
    return data.gameId;
  }

  protected override getActionType(): GameActionType {
    return GameActionType.JOIN;
  }

  protected async validateInput(
    data: GameJoinInputData
  ): Promise<GameJoinInputData> {
    return GameValidator.validateJoinInput(data);
  }

  protected async authorize(
    data: GameJoinInputData,
    context: SocketEventContext
  ): Promise<void> {
    const socketData = await this.socketUserDataService.getSocketData(
      context.socketId
    );
    if (socketData?.gameId === data.gameId) {
      throw new ClientError(ClientResponse.ALREADY_IN_GAME);
    }

    if (this.socket.rooms.has(data.gameId)) {
      const targetSocket = this.socket.nsp.sockets.get(context.socketId);
      if (targetSocket) {
        await targetSocket.leave(data.gameId);
      }
    }
  }

  protected override async afterHandle(
    result: SocketEventResult<GameJoinOutputData>,
    _context: SocketEventContext
  ): Promise<void> {
    const gameId = result.context?.gameId;
    if (!gameId || !result.success || !result.data) {
      return;
    }

    await this.socket.join(gameId);

    const players = result.data.players;
    const currentUserId = this.socket.userId;

    const existingPlayerIds = players
      .filter((p) => p.meta.id !== currentUserId)
      .map((p) => p.meta.id);

    if (existingPlayerIds.length > 0) {
      await this.userNotificationRoomService.subscribeToMultipleUserNotifications(
        this.socket.id,
        existingPlayerIds
      );
    }

    if (players.length > 1 && currentUserId) {
      await this.userNotificationRoomService.subscribeGameToUserNotifications(
        gameId,
        currentUserId
      );
    }
  }
}
