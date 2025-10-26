import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
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
    // No input validation needed for leave event
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

  protected override getActionType(): string {
    return "player:leave";
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameLeaveBroadcastData>> {
    // Handle lobby leave through game service
    const result = await this.socketIOGameService.leaveLobby(context.socketId);

    if (!result.emit || !result.data) {
      return {
        success: true,
        data: { user: -1 }, // No user to broadcast
        broadcast: [],
      };
    }

    // Assign context variables for logging
    context.gameId = result.data.gameId;

    const broadcastData: GameLeaveBroadcastData = {
      user: result.data.userId,
    };

    return {
      success: true,
      data: broadcastData,
      context: {
        ...context,
        gameId: result.data.gameId,
      },
      broadcast: [
        {
          event: SocketIOGameEvents.LEAVE,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.data.gameId,
        },
      ],
    };
  }

  protected override async afterBroadcast(
    result: SocketEventResult<GameLeaveBroadcastData>,
    context: SocketEventContext
  ): Promise<void> {
    if (context.gameId) {
      // Get game state before leaving to get player list
      try {
        const game = await this.socketIOGameService.getGameEntity(
          context.gameId
        );
        const allPlayerIds = game.players.map((p) => p.meta.id);

        // Unsubscribe from all other players' notification rooms
        await this.userNotificationRoomService.unsubscribeFromMultipleUserNotifications(
          context.socketId,
          allPlayerIds
        );

        // Unsubscribe all remaining players from this user's notification room
        if (result.data && result.data.user !== -1) {
          await this.userNotificationRoomService.unsubscribeGameFromUserNotifications(
            context.gameId,
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
            `Deleting empty game ${context.gameId} after last player left`,
            { prefix: "[USER_NOTIFICATIONS]: " }
          );
          await this.socketIOGameService.deleteGameInternally(context.gameId);
        }
      } catch (error) {
        // Game might not exist anymore, just clean up socket room
        this.logger.error(
          `Could not clean up user notification rooms for game ${context.gameId}: ${error}`,
          { prefix: "[USER_NOTIFICATIONS]: " }
        );
      }

      await this.socket.leave(context.gameId);
    }
  }
}
