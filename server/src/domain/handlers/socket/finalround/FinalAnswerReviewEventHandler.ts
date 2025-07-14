import { Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for showman to review and score final round answers
 * This follows the same pattern as regular AnswerResultEventHandler
 * but specifically for final round with bid-based scoring
 */
export class FinalAnswerReviewEventHandler extends BaseSocketEventHandler<
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    private readonly finalRoundService: FinalRoundService
  ) {
    super(socket, eventEmitter);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.FINAL_ANSWER_REVIEW;
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

  protected async execute(
    data: FinalAnswerReviewInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<FinalAnswerReviewOutputData>> {
    const { game, isGameFinished, reviewResult, questionAnswerData } =
      await this.finalRoundService.handleFinalAnswerReview(
        this.socket.id,
        data
      );

    context.gameId = game.id;

    const outputData: FinalAnswerReviewOutputData = {
      answerId: data.answerId,
      playerId: reviewResult.playerId,
      isCorrect: data.isCorrect,
      scoreChange: reviewResult.scoreChange,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_ANSWER_REVIEW,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalAnswerReviewOutputData>,
    ];

    // When all reviews are complete and game finishes
    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: {
          answerFiles: null,
          answerText: questionAnswerData?.answerText ?? null,
          nextTurnPlayerId: null, // No next turn when game finished
        },
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionFinishEventPayload>);

      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<boolean>);
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}
