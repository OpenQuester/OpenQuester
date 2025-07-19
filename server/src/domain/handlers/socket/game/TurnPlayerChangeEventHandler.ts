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
  TurnPlayerChangeBroadcastData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for turn player change events
 */
export class TurnPlayerChangeEventHandler extends BaseSocketEventHandler<
  TurnPlayerChangeInputData,
  TurnPlayerChangeBroadcastData
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
    return SocketIOGameEvents.TURN_PLAYER_CHANGED;
  }

  protected async validateInput(
    data: TurnPlayerChangeInputData
  ): Promise<TurnPlayerChangeInputData> {
    return GameValidator.validateTurnPlayerChange(data);
  }

  protected async authorize(
    _data: TurnPlayerChangeInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: TurnPlayerChangeInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<TurnPlayerChangeBroadcastData>> {
    const result = await this.socketIOGameService.changeTurnPlayer(
      this.socket.id,
      data.newTurnPlayerId
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const broadcastData: TurnPlayerChangeBroadcastData = {
      newTurnPlayerId: data.newTurnPlayerId,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.TURN_PLAYER_CHANGED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
