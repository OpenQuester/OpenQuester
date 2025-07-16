import { Socket } from "socket.io";

import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameUnpauseBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class UnpauseGameEventHandler extends BaseSocketEventHandler<
  void,
  GameUnpauseBroadcastData
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
    return SocketIOGameEvents.GAME_UNPAUSE;
  }

  protected async validateInput(data: void): Promise<void> {
    // No input validation needed for unpause event
    return data;
  }

  protected async authorize(
    _data: void,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (showman role check)
  }

  protected async beforeHandle(
    _data: void,
    _context: SocketEventContext
  ): Promise<void> {
    // Could add pre-unpause activities like validating game state, preparing timers
  }

  protected async execute(
    _data: void,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameUnpauseBroadcastData>> {
    // Execute the unpause logic
    const { game, timer } = await this.socketIOGameService.handleGameUnpause(
      this.socket.id
    );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const unpauseData: GameUnpauseBroadcastData = { timer };

    return {
      success: true,
      data: unpauseData,
      broadcast: [
        {
          event: SocketIOGameEvents.GAME_UNPAUSE,
          data: unpauseData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}
