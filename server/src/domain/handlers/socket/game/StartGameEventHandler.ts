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
  GameStartBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class StartGameEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  GameStartBroadcastData
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
    return SocketIOGameEvents.START;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed for start event
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameStartBroadcastData>> {
    // Execute the start game logic
    const gameDTO = await this.socketIOGameService.startGame(this.socket.id);

    // Assign context variables for logging
    context.gameId = gameDTO.id;
    context.userId = this.socket.userId;

    const startEventPayload: GameStartBroadcastData = {
      currentRound: gameDTO.gameState.currentRound!,
    };

    // Return result with broadcasting instructions
    return {
      success: true,
      data: startEventPayload,
      broadcast: [
        {
          event: SocketIOGameEvents.START,
          data: startEventPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: gameDTO.id,
        },
      ],
    };
  }
}
