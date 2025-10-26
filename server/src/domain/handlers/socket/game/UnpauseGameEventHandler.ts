import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
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
  GameUnpauseBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class UnpauseGameEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  GameUnpauseBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.GAME_UNPAUSE;
  }

  protected async getGameIdForAction(
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

  protected async validateInput(data: EmptyInputData): Promise<EmptyInputData> {
    // No input validation needed for unpause event
    return data;
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (showman role check)
  }

  protected async beforeHandle(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Could add pre-unpause activities like validating game state, preparing timers
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameUnpauseBroadcastData>> {
    // Execute the unpause logic
    const { game, timer } = await this.socketIOGameService.handleGameUnpause(
      context.socketId
    );

    // Assign context variables for logging
    context.gameId = game.id;

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
