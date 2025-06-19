import { Socket } from "socket.io";

import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  EmptyInputData,
  GameLeaveBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class LeaveGameEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  GameLeaveBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    private readonly socketIOGameService: SocketIOGameService
  ) {
    super(socket, eventEmitter);
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

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameLeaveBroadcastData>> {
    // Handle lobby leave through game service
    const result = await this.socketIOGameService.leaveLobby(this.socket.id);

    if (!result.emit || !result.data) {
      return {
        success: true,
        data: { user: -1 }, // No user to broadcast
        broadcast: [],
      };
    }

    // Update context with game information (for logging or further processing)
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
    _result: SocketEventResult<GameLeaveBroadcastData>,
    context: SocketEventContext
  ): Promise<void> {
    if (context.gameId) {
      await this.socket.leave(context.gameId);
    }
  }
}
