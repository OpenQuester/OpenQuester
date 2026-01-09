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
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class FinalAnswerSubmitEventHandler extends BaseSocketEventHandler<
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData
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
    return SocketIOGameEvents.FINAL_ANSWER_SUBMIT;
  }

  protected async getGameIdForAction(
    _data: FinalAnswerSubmitInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.FINAL_ANSWER_SUBMIT;
  }

  protected async validateInput(
    data: FinalAnswerSubmitInputData
  ): Promise<FinalAnswerSubmitInputData> {
    return GameValidator.validateFinalAnswerSubmit(data);
  }

  protected async authorize(
    _data: FinalAnswerSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
  }
}
