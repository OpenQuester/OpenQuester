import { Game } from "domain/entities/game/Game";
import { TransitionResult } from "domain/state-machine/types";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { BiddingTimeoutResult } from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalBiddingToAnsweringMutationData } from "domain/types/socket/transition/final";

/** Default bid amount for timeout auto-bids */
const TIMEOUT_BID_AMOUNT = 1;

/**
 * Result of bidding timeout processing.
 */
export interface BiddingTimeoutMutationResult {
  /** Bids that were auto-submitted due to timeout */
  timeoutBids: PlayerBidData[];
}

/**
 * Static utility class for final round bidding timeout logic.
 *
 * Pattern: Pure mutation functions, no dependencies.
 * Used by handlers to separate business logic from orchestration.
 */
export class BiddingTimeoutLogic {
  /**
   * Process bidding timeout by auto-submitting bids for players who haven't bid.
   *
   * @returns Array of auto-submitted bids
   */
  public static processTimeout(game: Game): BiddingTimeoutMutationResult {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    const timeoutBids: PlayerBidData[] = [];

    if (!finalRoundData) {
      return { timeoutBids };
    }

    // Find players who haven't submitted bids
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    for (const player of eligiblePlayers) {
      if (finalRoundData.bids[player.meta.id] === undefined) {
        FinalRoundStateManager.addBid(game, player.meta.id, TIMEOUT_BID_AMOUNT);
        timeoutBids.push({
          playerId: player.meta.id,
          bidAmount: TIMEOUT_BID_AMOUNT,
        });
      }
    }

    return { timeoutBids };
  }

  /**
   * Check if all bids have been submitted (including timeout bids).
   */
  public static areAllBidsSubmitted(game: Game): boolean {
    return FinalRoundStateManager.areAllBidsSubmitted(game);
  }

  /**
   * Builds the result object from timeout mutation + transition outcome.
   */
  public static buildResult(input: {
    game: Game;
    mutationResult: BiddingTimeoutMutationResult;
    transitionResult: TransitionResult;
  }): BiddingTimeoutResult {
    const { game, mutationResult, transitionResult } = input;
    const mutationData =
      transitionResult.data as FinalBiddingToAnsweringMutationData;

    const questionData = mutationData.questionData;

    return {
      game,
      timeoutBids: mutationResult.timeoutBids,
      questionData,
      transitionResult,
    };
  }
}
