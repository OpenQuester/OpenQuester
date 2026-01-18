import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Boolean-returning guard functions for transition eligibility checks.
 *
 * Unlike validators (which throw errors), guards return true/false
 * for use in `canTransition` methods where we need silent failure.
 *
 * Pattern: Static utility class with pure predicate functions.
 */
export class TransitionGuards {
  // ============================================================
  // Game State Guards
  // ============================================================

  /**
   * Checks if game is currently in progress (started, not finished, not paused).
   */
  public static isGameInProgress(game: Game): boolean {
    return (
      game.startedAt !== null &&
      game.finishedAt === null &&
      game.gameState !== null &&
      !game.gameState.isPaused
    );
  }

  /**
   * Checks if game has started.
   */
  public static isGameStarted(game: Game): boolean {
    return game.startedAt !== null && game.gameState !== null;
  }

  /**
   * Checks if game is finished.
   */
  public static isGameFinished(game: Game): boolean {
    return game.finishedAt !== null;
  }

  // ============================================================
  // Round Type Guards
  // ============================================================

  /**
   * Checks if current round is final round.
   */
  public static isFinalRound(game: Game): boolean {
    return game.gameState?.currentRound?.type === PackageRoundType.FINAL;
  }

  /**
   * Checks if current round is a simple/regular round.
   */
  public static isSimpleRound(game: Game): boolean {
    return game.gameState?.currentRound?.type === PackageRoundType.SIMPLE;
  }

  // ============================================================
  // Question State Guards
  // ============================================================

  /**
   * Checks if question state matches expected value.
   */
  public static isQuestionState(
    game: Game,
    expectedState: QuestionState
  ): boolean {
    return game.gameState?.questionState === expectedState;
  }

  /**
   * Checks if final round phase matches expected value.
   */
  public static isFinalRoundPhase(
    game: Game,
    expectedPhase: FinalRoundPhase
  ): boolean {
    return game.gameState?.finalRoundData?.phase === expectedPhase;
  }

  /**
   * Checks if there is an answering player set.
   */
  public static hasAnsweringPlayer(game: Game): boolean {
    return game.gameState?.answeringPlayer !== null;
  }

  /**
   * Checks if there's an active stake question bidding phase.
   */
  public static isStakeBiddingPhase(game: Game): boolean {
    return (
      game.gameState?.stakeQuestionData?.biddingPhase === true &&
      TransitionGuards.isQuestionState(game, QuestionState.BIDDING)
    );
  }

  /**
   * Checks if there's an active secret question transfer phase.
   */
  public static isSecretTransferPhase(game: Game): boolean {
    return (
      game.gameState.secretQuestionData?.transferDecisionPhase === true &&
      TransitionGuards.isQuestionState(game, QuestionState.SECRET_TRANSFER)
    );
  }

  // ============================================================
  // Player Guards
  // ============================================================

  /**
   * Checks if there are any eligible players (in-game, player role).
   */
  public static hasEligiblePlayers(game: Game): boolean {
    return game.players.some(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  /**
   * Checks if there are at least two eligible players (transfer requires >1).
   */
  public static hasMultipleEligiblePlayers(game: Game): boolean {
    let eligibleCount = 0;

    for (const player of game.players) {
      if (
        player.role === PlayerRole.PLAYER &&
        player.gameStatus === PlayerGameStatus.IN_GAME
      ) {
        eligibleCount += 1;

        if (eligibleCount >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a specific player is eligible (in-game, player role).
   */
  public static isPlayerEligible(game: Game, playerId: number): boolean {
    const player = game.getPlayer(playerId, { fetchDisconnected: true });
    return (
      player !== null &&
      player.role === PlayerRole.PLAYER &&
      player.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  // ============================================================
  // Final Round Specific Guards
  // ============================================================

  /**
   * Checks if all final round bids have been submitted.
   */
  public static areAllFinalBidsSubmitted(game: Game): boolean {
    return FinalRoundStateManager.areAllBidsSubmitted(game);
  }

  /**
   * Checks if all final round answers have been submitted.
   */
  public static areAllFinalAnswersSubmitted(game: Game): boolean {
    return FinalRoundStateManager.areAllAnswersSubmitted(game);
  }

  /**
   * Checks if all final round answers have been reviewed.
   */
  public static areAllFinalAnswersReviewed(game: Game): boolean {
    return FinalRoundStateManager.areAllAnswersReviewed(game);
  }

  /**
   * Checks if player has submitted final round bid.
   */
  public static hasPlayerSubmittedFinalBid(
    game: Game,
    playerId: number
  ): boolean {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    return finalRoundData?.bids[playerId] !== undefined;
  }

  /**
   * Checks if player has submitted final round answer.
   */
  public static hasPlayerSubmittedFinalAnswer(
    game: Game,
    playerId: number
  ): boolean {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    return finalRoundData?.answers[playerId] !== undefined;
  }

  // ============================================================
  // Combined Guards for Final Round
  // ============================================================

  /**
   * Combined check for final round in specific phase.
   * Validates: game in progress + final round + question state + final round phase
   */
  public static canTransitionInFinalRound(
    game: Game,
    expectedQuestionState: QuestionState,
    expectedFinalPhase: FinalRoundPhase
  ): boolean {
    return (
      TransitionGuards.isGameInProgress(game) &&
      TransitionGuards.isFinalRound(game) &&
      TransitionGuards.isQuestionState(game, expectedQuestionState) &&
      TransitionGuards.isFinalRoundPhase(game, expectedFinalPhase)
    );
  }

  // ============================================================
  // Combined Guards for Regular Rounds
  // ============================================================

  /**
   * Combined check for regular round question handling.
   * Validates: game in progress + simple round + question state
   */
  public static canTransitionInRegularRound(
    game: Game,
    expectedQuestionState: QuestionState
  ): boolean {
    return (
      TransitionGuards.isGameInProgress(game) &&
      TransitionGuards.isSimpleRound(game) &&
      TransitionGuards.isQuestionState(game, expectedQuestionState)
    );
  }

  /**
   * Combined check for any round question handling (final or simple).
   * Validates: game in progress + question state
   */
  public static canTransitionInAnyRound(
    game: Game,
    expectedQuestionState: QuestionState
  ): boolean {
    return (
      TransitionGuards.isGameInProgress(game) &&
      TransitionGuards.isQuestionState(game, expectedQuestionState)
    );
  }
}
