import { Game } from "domain/entities/game/Game";
import { TransitionResult } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import type {
  AnswerData,
  AutoLossProcessResult
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundGameData } from "domain/types/finalround/FinalRoundInterfaces";
import { FinalAnsweringToReviewingMutationData } from "domain/types/socket/transition/final";

/**
 * Result of auto-loss processing
 */
export interface AutoLossProcessMutationResult {
  autoLossPlayerIds: number[];
  isPhaseComplete: boolean;
}

/**
 * Logic class for processing auto-loss answers when answering timer expires.
 *
 * Finds players who haven't submitted answers and creates auto-loss entries
 * (empty answers marked incorrect, with penalties deferred until review).
 */
export class AutoLossProcessLogic {
  /**
   * Apply auto-loss for a single player (used when a player leaves during final answering).
   *
   * Returns the recorded answer if applied, otherwise null.
   */
  public static processPlayerAutoLoss(game: Game, playerId: number): AnswerData | null {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (
      !finalRoundData ||
      (game.gameState.questionState !== QuestionState.ANSWERING &&
        !(
          game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING &&
          finalRoundData.questionData?.mediaPreparationId
        ))
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

    const hasSubmitted = finalRoundData.answers.some((answer) => answer.playerId === playerId);
    if (hasSubmitted) {
      return null;
    }

    return FinalRoundStateManager.addAnswer(game, playerId, "", true);
  }

  /**
   * Process auto-loss for players who haven't submitted answers.
   *
   * Pure mutation function that:
   * 1. Finds unanswered positive bids, including disconnected players
   * 2. Adds empty answer (auto-marked as autoLoss)
   * 3. Records the loss for settlement when review begins
   * 4. Returns affected player IDs and phase completion status
   */
  public static processAutoLoss(
    game: Game,
    finalRoundData: FinalRoundGameData
  ): AutoLossProcessMutationResult {
    if (game.gameState.questionState !== QuestionState.ANSWERING) {
      return {
        autoLossPlayerIds: [],
        isPhaseComplete: false
      };
    }

    const autoLossPlayerIds: number[] = [];

    // Every positive bid must be settled, even if its player disconnected.
    const bidderIds = Object.entries(finalRoundData.bids)
      .filter(([, bid]) => bid > 0)
      .map(([playerId]) => Number(playerId));

    for (const playerId of bidderIds) {
      const hasSubmitted = finalRoundData.answers.some((answer) => answer.playerId === playerId);

      if (!hasSubmitted) {
        FinalRoundStateManager.addAnswer(game, playerId, "", true);
        autoLossPlayerIds.push(playerId);
      }
    }

    // Check if ready for review phase
    const isPhaseComplete = FinalRoundStateManager.areAllAnswersSubmitted(game);

    return {
      autoLossPlayerIds,
      isPhaseComplete
    };
  }

  /**
   * Builds service-friendly result shape from auto-loss mutation + transition.
   *
   * TimerExpirationService only needs IDs for submission and auto-loss notifications.
   */
  public static buildResult(input: {
    game: Game;
    mutationResult: AutoLossProcessMutationResult;
    transitionResult: TransitionResult | null;
  }): AutoLossProcessResult {
    const { game, mutationResult, transitionResult } = input;
    const transitionData = transitionResult?.data as
      | FinalAnsweringToReviewingMutationData
      | undefined;

    const isReadyForReview = mutationResult.isPhaseComplete;

    const allReviews = isReadyForReview
      ? (transitionData?.allReviews ?? FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game))
      : undefined;

    return {
      game,
      autoLossPlayerIds: mutationResult.autoLossPlayerIds,
      isReadyForReview,
      allReviews,
      transitionResult
    } satisfies AutoLossProcessResult;
  }
}
