import { Socket } from "socket.io";

import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class AnswerResultEventHandler extends BaseSocketEventHandler<
  AnswerResultData,
  QuestionAnswerResultEventPayload
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.ANSWER_RESULT;
  }

  protected async validateInput(data: AnswerResultData): Promise<any> {
    return GameValidator.validateAnswerResult(data);
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in service
  }

  protected async execute(
    data: AnswerResultData,
    context: SocketEventContext
  ): Promise<SocketEventResult<QuestionAnswerResultEventPayload>> {
    const { playerAnswerResult, game, question, timer } =
      await this.socketIOQuestionService.handleAnswerResult(
        this.socket.id,
        data
      );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    // Handle correct answers with round progression
    if (playerAnswerResult.answerType === AnswerResultType.CORRECT) {
      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(game);

      const answerResultPayload: QuestionAnswerResultEventPayload = {
        answerResult: playerAnswerResult,
        timer: null,
      };

      // Use the progression coordinator to handle the complete flow
      const progressionResult =
        await this.gameProgressionCoordinator.processGameProgression({
          game,
          isGameFinished,
          nextGameState,
          questionFinishData: {
            answerFiles: question?.answerFiles ?? null,
            answerText: question?.answerText ?? null,
            nextTurnPlayerId: game.gameState.currentTurnPlayerId!,
          },
        });

      // Create a special question finish event with answer result for correct answers
      const questionFinishWithAnswer: QuestionFinishWithAnswerEventPayload = {
        answerFiles: question?.answerFiles ?? null,
        answerText: question?.answerText ?? null,
        nextTurnPlayerId: game.gameState.currentTurnPlayerId!,
        answerResult: playerAnswerResult,
      };

      // Replace the basic question finish broadcast with the enhanced one
      const filteredBroadcasts = progressionResult.broadcasts.filter(
        (broadcast) => broadcast.event !== SocketIOGameEvents.QUESTION_FINISH
      );

      const allBroadcasts = [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: answerResultPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
        {
          event: SocketIOGameEvents.QUESTION_FINISH,
          data: questionFinishWithAnswer,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
        ...filteredBroadcasts,
      ];

      return {
        success: true,
        data: answerResultPayload,
        broadcast: allBroadcasts,
      };
    }

    // For wrong or skip answers
    const resultPayload: QuestionAnswerResultEventPayload = {
      answerResult: playerAnswerResult,
      timer,
    };

    return {
      success: true,
      data: resultPayload,
      broadcast: [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: resultPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}
