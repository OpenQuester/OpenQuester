import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionAnswerEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  QuestionAnswerEventPayload
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
    return SocketIOGameEvents.QUESTION_ANSWER;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service
  }

  protected async execute(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<SocketEventResult<QuestionAnswerEventPayload>> {
    const { userId, gameId, timer } =
      await this.socketIOQuestionService.handleQuestionAnswer(this.socket.id);

    const result: QuestionAnswerEventPayload = {
      userId: userId!,
      timer: timer.value()!,
    };

    return {
      success: true,
      data: result,
      broadcast: [
        {
          event: SocketIOGameEvents.QUESTION_ANSWER,
          data: result,
          target: SocketBroadcastTarget.GAME,
          gameId,
        },
      ],
    };
  }
}
