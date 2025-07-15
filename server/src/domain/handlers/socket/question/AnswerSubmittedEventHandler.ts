import { Socket } from "socket.io";

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
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.ANSWER_SUBMITTED;
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
    _context: SocketEventContext
  ): Promise<SocketEventResult<AnswerSubmittedBroadcastData>> {
    const game = await this.socketIOQuestionService.handleAnswerSubmitted(
      this.socket.id
    );

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
