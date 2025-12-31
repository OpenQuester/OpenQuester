import { Game } from "domain/entities/game/Game";
import { TransitionResult } from "domain/state-machine/types";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  AnswerReviewData,
  FinalAnswerReviewResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { QuestionAnswerData } from "domain/types/socket/finalround/QuestionAnswerData";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";

/**
 * Result of answer review validation and mutation.
 */
export interface AnswerReviewMutationResult {
  /** The reviewed answer data */
  reviewResult: AnswerReviewData;
  /** Whether all answers have been reviewed */
  isPhaseComplete: boolean;
  /** All reviews (only populated when phase is complete) */
  allReviews?: AnswerReviewData[];
}

/**
 * Static utility class for final round answer review logic.
 *
 * Pattern: Pure validation + mutation functions, no dependencies.
 * Used by handlers to separate business logic from orchestration.
 */
export class FinalAnswerReviewLogic {
  /**
   * Validate that the game is in reviewing phase and ready for review.
   * Throws ClientError if invalid.
   */
  public static validate(game: Game): void {
    FinalRoundValidator.validateReviewingPhase(game);
  }

  /**
   * Review a single answer and update game state.
   */
  public static reviewAnswer(
    game: Game,
    answerData: FinalAnswerReviewInputData
  ): AnswerReviewMutationResult {
    // Review the answer (mutates game state)
    const { answer, scoreChange } = FinalRoundStateManager.reviewAnswer(
      game,
      answerData.answerId,
      answerData.isCorrect
    );

    const isPhaseComplete = FinalRoundStateManager.areAllAnswersReviewed(game);

    const reviewResult = FinalRoundPhaseCompletionHelper.createAnswerReviewData(
      answer,
      scoreChange,
      answerData.isCorrect
    );

    const result: AnswerReviewMutationResult = {
      reviewResult,
      isPhaseComplete,
    };

    if (isPhaseComplete) {
      result.allReviews =
        FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game);
    }

    return result;
  }

  /**
   * Check if all answers have been reviewed.
   */
  public static areAllAnswersReviewed(game: Game): boolean {
    return FinalRoundStateManager.areAllAnswersReviewed(game);
  }

  /**
   * Builds the answer review result from mutation and transition results.
   */
  public static buildResult(input: {
    game: Game;
    mutationResult: AnswerReviewMutationResult;
    transitionResult: TransitionResult | null;
  }): FinalAnswerReviewResult {
    const { game, mutationResult, transitionResult } = input;

    const isGameFinished = Boolean(transitionResult?.data?.isGameFinished);
    const questionAnswerData = isGameFinished
      ? (transitionResult!.data!.questionAnswerData as QuestionAnswerData)
      : undefined;

    return {
      game,
      isGameFinished,
      reviewResult: mutationResult.reviewResult,
      allReviews: mutationResult.allReviews,
      questionAnswerData,
    } satisfies FinalAnswerReviewResult;
  }
}
