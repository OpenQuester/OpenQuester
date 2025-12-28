import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import {
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class LeaveGameEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  GameLeaveBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.LEAVE;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Any authenticated user can leave a game
  }

  protected override async getGameIdForAction(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
  }

  protected override getActionType(): GameActionType {
    return GameActionType.LEAVE;
  }

  protected override async afterBroadcast(
    result: SocketEventResult<GameLeaveBroadcastData>,
    _context: SocketEventContext
  ): Promise<void> {
    const gameId = result.context?.gameId;
    const socketId = result.context?.socketId;

    if (gameId && socketId) {
      try {
        const game = await this.socketIOGameService.getGameEntity(gameId);
        const allPlayerIds = game.players.map((p) => p.meta.id);

        await this.userNotificationRoomService.unsubscribeFromMultipleUserNotifications(
          socketId,
          allPlayerIds
        );

        if (result.data && result.data.user !== -1) {
          await this.userNotificationRoomService.unsubscribeGameFromUserNotifications(
            gameId,
            result.data.user
          );
        }

        const activePlayers = game.players.filter(
          (p) => p.gameStatus === PlayerGameStatus.IN_GAME
        );

        const gameNotStartedOrFinished =
          game.startedAt === null || game.finishedAt !== null;

        if (activePlayers.length === 0 && gameNotStartedOrFinished) {
          this.logger.debug(
            `Deleting empty game ${gameId} after last player left`,
            { prefix: "[USER_NOTIFICATIONS]: " }
          );
          await this.socketIOGameService.deleteGameInternally(gameId);
        }
      } catch (error) {
        this.logger.error(
          `Could not clean up user notification rooms for game ${gameId}: ${error}`,
          { prefix: "[USER_NOTIFICATIONS]: " }
        );
      }

      const targetSocket = this.socket.nsp.sockets.get(socketId);
      if (targetSocket) {
        await targetSocket.leave(gameId);
      }
    }
  }
}
