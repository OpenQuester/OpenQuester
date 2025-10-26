import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
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
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
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

  protected async execute(
    data: AnswerSubmittedInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<AnswerSubmittedBroadcastData>> {
    const game = await this.socketIOQuestionService.handleAnswerSubmitted(
      context.socketId
    );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = context.userId;

    const broadcastData: AnswerSubmittedBroadcastData = {
      answerText: data.answerText,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.ANSWER_SUBMITTED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}
