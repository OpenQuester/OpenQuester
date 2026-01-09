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
  EmptyInputData,
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for player ready events
 */
export class PlayerReadyEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  PlayerReadinessBroadcastData
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
    return SocketIOGameEvents.PLAYER_READY;
  }

  protected async getGameIdForAction(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.PLAYER_READY;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed for ready event
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (player role check)
  }
}
