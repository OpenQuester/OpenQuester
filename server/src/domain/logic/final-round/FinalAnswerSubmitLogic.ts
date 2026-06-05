import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { TransitionResult } from "domain/state-machine/types";
import {
  AnswerReviewData,
  FinalAnswerSubmitResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Result of answer submission mutation
 */
interface AnswerSubmitMutationResult {
  /** The submitted answer text (trimmed) */
  answerText: string;

  /** Whether this is an auto-loss (empty answer) */
  isAutoLoss: boolean;
}

/**
 * Result of phase completion check
 */
interface AnswerPhaseCompletionResult {
  /** Whether all answers have been submitted */
  isPhaseComplete: boolean;

  /** All reviews (if phase complete) */
  allReviews: AnswerReviewData[] | undefined;
}

interface FinalAnswerSubmitInput {
  game: Game;
  player: Player;
  mutationResult: AnswerSubmitMutationResult;
  completionResult: AnswerPhaseCompletionResult;
  transitionResult: TransitionResult | null;
}

/**
 * Pure business logic for final round answer submission.
 *
 * This class encapsulates all validation and state mutation logic,
 * keeping the service layer thin and focused on orchestration.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class FinalAnswerSubmitLogic {
  /**
   * Normalizes answer text (trims whitespace).
   *
   * @returns Trimmed answer text
   */
  public static normalizeAnswer(answerText: string): string {
    return answerText.trim() || "";
  }

  /**
   * Adds an answer for the player.
   *
   * @returns Mutation result with answer text and auto-loss flag
   */
  public static addAnswer(
    game: Game,
    playerId: number,
    answerText: string
  ): AnswerSubmitMutationResult {
    const trimmedAnswer = FinalAnswerSubmitLogic.normalizeAnswer(answerText);
    const isAutoLoss = trimmedAnswer.length === 0;

    FinalRoundStateManager.addAnswer(game, playerId, trimmedAnswer, isAutoLoss);

    return {
      answerText: trimmedAnswer,
      isAutoLoss,
    };
  }

  /**
   * Checks if the answering phase is complete.
   *
   * @returns Phase completion result with reviews if complete
   */
  public static checkPhaseCompletion(game: Game): AnswerPhaseCompletionResult {
    const { isPhaseComplete, allReviews } =
      FinalRoundPhaseCompletionHelper.checkAnsweringPhaseCompletion(game);

    return {
      isPhaseComplete,
      allReviews,
    };
  }

  /**
   * Builds the result object from submission data.
   */
  public static buildResult(
    input: FinalAnswerSubmitInput
  ): FinalAnswerSubmitResult {
    const { game, player, mutationResult, completionResult, transitionResult } =
      input;

    return {
      game,
      playerId: player.meta.id,
      isPhaseComplete: completionResult.isPhaseComplete,
      isAutoLoss: mutationResult.isAutoLoss,
      allReviews: completionResult.allReviews,
      transitionResult: transitionResult ?? undefined,
    };
  }
}
