import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  AnswerSubmittedBroadcastData,
  AnswerSubmittedInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class AnswerSubmittedEventHandler extends BaseSocketEventHandler<
  AnswerSubmittedInputData,
  AnswerSubmittedBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.ANSWER_SUBMITTED;
  }

  protected async getGameIdForAction(
    _data: AnswerSubmittedInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.ANSWER_SUBMITTED;
  }

  protected async validateInput(
    data: AnswerSubmittedInputData
  ): Promise<AnswerSubmittedInputData> {
    return GameValidator.validateAnswerSubmitted(data);
  }

  protected async authorize(
    _data: AnswerSubmittedInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service - checks if user is answering player
  }
}
