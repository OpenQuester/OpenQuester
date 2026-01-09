import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
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
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.SCORE_CHANGED;
  }

  protected async getGameIdForAction(
    _data: PlayerScoreChangeInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.PLAYER_SCORE_CHANGE;
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
}
