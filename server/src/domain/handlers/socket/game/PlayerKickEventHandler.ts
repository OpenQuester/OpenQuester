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
  PlayerKickBroadcastData,
  PlayerKickInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for player kick events
 */
export class PlayerKickEventHandler extends BaseSocketEventHandler<
  PlayerKickInputData,
  PlayerKickBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly socketIOGameService: SocketIOGameService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_KICKED;
  }

  protected async validateInput(
    data: PlayerKickInputData
  ): Promise<PlayerKickInputData> {
    return GameValidator.validatePlayerKick(data);
  }

  protected async authorize(
    _data: PlayerKickInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: PlayerKickInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerKickBroadcastData>> {
    const result = await this.socketIOGameService.kickPlayer(
      this.socket.id,
      data.playerId
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const broadcastData: PlayerKickBroadcastData = {
      playerId: data.playerId,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.PLAYER_KICKED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
        {
          event: SocketIOGameEvents.LEAVE,
          data: { user: data.playerId },
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
