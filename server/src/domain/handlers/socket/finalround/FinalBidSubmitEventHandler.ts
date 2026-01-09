import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class FinalBidSubmitEventHandler extends BaseSocketEventHandler<
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.FINAL_BID_SUBMIT;
  }

  protected async getGameIdForAction(
    _data: FinalBidSubmitInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.FINAL_BID_SUBMIT;
  }

  protected async validateInput(
    data: FinalBidSubmitInputData
  ): Promise<FinalBidSubmitInputData> {
    return GameValidator.validateBid(data);
  }

  protected async authorize(
    _data: FinalBidSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
  }
}
