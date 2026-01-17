import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Stateless action handler for final round answer review.
 * Extracts business logic from FinalAnswerReviewEventHandler.
 */
export class FinalAnswerReviewActionHandler
  implements
    GameActionHandler<FinalAnswerReviewInputData, FinalAnswerReviewOutputData>
{
  constructor(
    private readonly finalRoundService: FinalRoundService,
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly logger: ILogger
  ) {
    //
  }

  public async execute(
    action: GameAction<FinalAnswerReviewInputData>
  ): Promise<GameActionHandlerResult<FinalAnswerReviewOutputData>> {
    const { game, isGameFinished, reviewResult, questionAnswerData } =
      await this.finalRoundService.handleFinalAnswerReview(
        createActionContextFromAction(action),
        action.payload
      );

    const outputData: FinalAnswerReviewOutputData = {
      answerId: action.payload.answerId,
      playerId: reviewResult.playerId,
      isCorrect: action.payload.isCorrect,
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
          nextTurnPlayerId: null,
        } satisfies QuestionFinishEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionFinishEventPayload>);

      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<boolean>);

      // Trigger centralized game completion (statistics persistence)
      const completionResult =
        await this.gameLifecycleService.handleGameCompletion(game.id);

      if (!completionResult.success) {
        this.logger.error("Failed to execute statistics persistence", {
          prefix: LogPrefix.STATS,
          gameId: game.id,
          error: completionResult.error,
        });
      }
    }

    return { success: true, data: outputData, broadcasts };
  }
}
