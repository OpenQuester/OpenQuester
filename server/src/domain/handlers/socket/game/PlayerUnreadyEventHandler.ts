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
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { GameActionExecutor } from "application/executors/GameActionExecutor";

/**
 * Handler for player unready events
 */
export class PlayerUnreadyEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  PlayerReadinessBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_UNREADY;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed for unready event
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (player role check)
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerReadinessBroadcastData>> {
    // Execute the set unready logic
    const result = await this.socketIOGameService.setPlayerReadiness(
      this.socket.id,
      false
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const readyData: PlayerReadinessBroadcastData = {
      playerId: result.playerId,
      isReady: result.isReady,
      readyPlayers: result.readyPlayers,
      autoStartTriggered: false, // Unready does not trigger auto start
    };

    return {
      success: true,
      data: readyData,
      broadcast: [
        {
          event: SocketIOGameEvents.PLAYER_UNREADY,
          data: readyData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
