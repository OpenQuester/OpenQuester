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
  PlayerScoreChangeBroadcastData,
  PlayerScoreChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for player score change events
 */
export class PlayerScoreChangeEventHandler extends BaseSocketEventHandler<
  PlayerScoreChangeInputData,
  PlayerScoreChangeBroadcastData
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
    return SocketIOGameEvents.SCORE_CHANGED;
  }

  protected async validateInput(
    data: PlayerScoreChangeInputData
  ): Promise<PlayerScoreChangeInputData> {
    return GameValidator.validatePlayerScoreChange(data);
  }

  protected async authorize(
    _data: PlayerScoreChangeInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: PlayerScoreChangeInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerScoreChangeBroadcastData>> {
    const result = await this.socketIOGameService.changePlayerScore(
      this.socket.id,
      data.playerId,
      data.newScore
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: data.playerId,
      newScore: result.newScore,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.SCORE_CHANGED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}
