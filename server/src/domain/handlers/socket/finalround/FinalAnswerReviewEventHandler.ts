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
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class FinalAnswerReviewEventHandler extends BaseSocketEventHandler<
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData
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
    return SocketIOGameEvents.FINAL_ANSWER_REVIEW;
  }

  protected async getGameIdForAction(
    _data: FinalAnswerReviewInputData,
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

  protected override getActionType(): GameActionType {
    return GameActionType.FINAL_ANSWER_REVIEW;
  }

  protected async validateInput(
    data: FinalAnswerReviewInputData
  ): Promise<FinalAnswerReviewInputData> {
    return GameValidator.validateFinalAnswerReview(data);
  }

  protected async authorize(
    _data: FinalAnswerReviewInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service - only showman can review answers
  }
}
