import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerType } from "domain/enums/FinalRoundTypes";
import {
  AnswerData,
  AnswerReviewData,
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "./FinalRoundStateManager";

export interface FinalAnswerSubmitPhaseCheck {
  isPhaseComplete: boolean;
  allReviews?: AnswerReviewData[];
}

/**
 * Helper for handling final round phase completion logic
 * Extracted to avoid duplication between event handlers and leave service
 */
export class FinalRoundPhaseCompletionHelper {
  /**
   * Check if answering phase is complete after answer submission
   * If complete, transitions to reviewing phase and returns all reviews
   */
  public static checkAnsweringPhaseCompletion(
    game: Game
  ): FinalAnswerSubmitPhaseCheck {
    if (!FinalRoundStateManager.areAllAnswersSubmitted(game)) {
      return { isPhaseComplete: false };
    }

    // All answers submitted - transition to reviewing
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);

    // Get all reviews for showman
    const allReviews = this.getAllAnswerReviews(game);

    return {
      isPhaseComplete: true,
      allReviews,
    };
  }

  /**
   * Get all answer reviews for the game (for showman)
   * Creates review data for all submitted answers, including unreviewed ones
   */
  public static getAllAnswerReviews(game: Game): AnswerReviewData[] {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      return [];
    }

    return finalRoundData.answers.map((answer) => {
      const bidAmount = finalRoundData.bids[answer.playerId] || 0;

      // If answer is already reviewed, use that result
      if (answer.isCorrect !== undefined) {
        const scoreChange = answer.isCorrect ? bidAmount : -bidAmount;
        return this.createAnswerReviewData(
          answer,
          scoreChange,
          answer.isCorrect
        );
      }

      // For unreviewed answers, create review data
      return this.createAnswerReviewData(answer, 0, null);
    });
  }

  /**
   * Create answer review data from answer object
   */
  public static createAnswerReviewData(
    answer: AnswerData,
    scoreChange: number,
    isCorrect: boolean | null
  ): AnswerReviewData {
    let answerType: FinalAnswerType;
    if (answer.autoLoss) {
      answerType = FinalAnswerType.AUTO_LOSS;
    } else if (isCorrect === null) {
      answerType = FinalAnswerType.PENDING;
    } else if (isCorrect) {
      answerType = FinalAnswerType.CORRECT;
    } else {
      answerType = FinalAnswerType.WRONG;
    }

    return {
      playerId: answer.playerId,
      answerId: answer.id,
      answerText: answer.answer,
      scoreChange,
      answerType,
      isCorrect,
    };
  }
}
