import { Game } from "domain/entities/game/Game";
import { TransitionResult } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  AnswerData,
  AnswerReviewData,
  AutoLossProcessResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Data for a single auto-loss entry
 */
export interface AutoLossEntry {
  answerData: AnswerData;
  scoreChange: number;
}

/**
 * Result of auto-loss processing
 */
export interface AutoLossProcessMutationResult {
  autoLossEntries: AutoLossEntry[];
  isPhaseComplete: boolean;
}

/**
 * Logic class for processing auto-loss answers when answering timer expires.
 *
 * Finds players who haven't submitted answers and creates auto-loss entries
 * (empty answers marked incorrect with score penalty).
 */
export class AutoLossProcessLogic {
  /**
   * Apply auto-loss for a single player (used when a player leaves during final answering).
   *
   * Returns a single AutoLossEntry if applied, otherwise null.
   */
  public static processPlayerAutoLoss(
    game: Game,
    playerId: number
  ): AutoLossEntry | null {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (
      !finalRoundData ||
      game.gameState.questionState !== QuestionState.ANSWERING
    ) {
      return null;
    }

    const player = game.getPlayer(playerId, { fetchDisconnected: true });
    if (
      !player ||
      player.role !== PlayerRole.PLAYER ||
      player.gameStatus !== PlayerGameStatus.IN_GAME
    ) {
      return null;
    }

    // bid=0 means player doesn't participate in final answering
    if ((finalRoundData.bids[playerId] || 0) <= 0) {
      return null;
    }

    const hasSubmitted = finalRoundData.answers.some(
      (answer) => answer.playerId === playerId
    );
    if (hasSubmitted) {
      return null;
    }

    const answer = FinalRoundStateManager.addAnswer(game, playerId, "", true);

    const answerData: AnswerData = {
      id: answer.id,
      playerId: answer.playerId,
      answer: answer.answer,
      autoLoss: answer.autoLoss,
    };

    const { scoreChange } = FinalRoundStateManager.reviewAnswer(
      game,
      answer.id,
      false
    );

    return {
      answerData,
      scoreChange,
    };
  }

  /**
   * Process auto-loss for players who haven't submitted answers.
   *
   * Pure mutation function that:
   * 1. Finds eligible players (in game, with bids > 0, haven't submitted)
   * 2. Adds empty answer (auto-marked as autoLoss)
   * 3. Immediately reviews as incorrect (applies score penalty)
   * 4. Returns entries and phase completion status
   */
  public static processAutoLoss(game: Game): AutoLossProcessMutationResult {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (
      !finalRoundData ||
      game.gameState.questionState !== QuestionState.ANSWERING
    ) {
      return {
        autoLossEntries: [],
        isPhaseComplete: false,
      };
    }

    const autoLossEntries: AutoLossEntry[] = [];

    // Find players who haven't submitted answers
    // Only process players with non-zero bids (bid=0 means they don't participate)
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        (finalRoundData.bids[p.meta.id] || 0) > 0
    );

    for (const player of eligiblePlayers) {
      const hasSubmitted = finalRoundData.answers.some(
        (answer) => answer.playerId === player.meta.id
      );

      if (!hasSubmitted) {
        // Add empty answer as auto-loss (automatically marked by StateManager)
        const answer = FinalRoundStateManager.addAnswer(
          game,
          player.meta.id,
          "",
          true
        );

        // Create answer data (answer.autoLoss is true for empty answers)
        const answerData: AnswerData = {
          id: answer.id,
          playerId: answer.playerId,
          answer: answer.answer,
          autoLoss: answer.autoLoss,
        };

        // Immediately mark as incorrect and update score
        const { scoreChange } = FinalRoundStateManager.reviewAnswer(
          game,
          answer.id,
          false
        );

        autoLossEntries.push({
          answerData,
          scoreChange,
        });
      }
    }

    // Check if ready for review phase
    const isPhaseComplete = FinalRoundStateManager.areAllAnswersSubmitted(game);

    return {
      autoLossEntries,
      isPhaseComplete,
    };
  }

  /**
   * Builds service-friendly result shape from auto-loss mutation + transition.
   *
   * Keeps the result contract stable for TimerExpirationService.
   */
  public static buildResult(input: {
    game: Game;
    mutationResult: AutoLossProcessMutationResult;
    transitionResult: TransitionResult | null;
  }): AutoLossProcessResult {
    const { game, mutationResult, transitionResult } = input;

    const autoLossReviews: AnswerReviewData[] =
      mutationResult.autoLossEntries.map((entry) =>
        FinalRoundPhaseCompletionHelper.createAnswerReviewData(
          entry.answerData,
          entry.scoreChange,
          false
        )
      );

    const isReadyForReview = mutationResult.isPhaseComplete;

    const allReviews = isReadyForReview
      ? (transitionResult?.data?.allReviews as
          | AnswerReviewData[]
          | undefined) ??
        FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game)
      : undefined;

    return {
      game,
      autoLossReviews,
      isReadyForReview,
      allReviews,
      transitionResult,
    } satisfies AutoLossProcessResult;
  }
}
