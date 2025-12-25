import { AUTO_BID_MINIMUM } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { TransitionResult } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { FinalBidSubmitOutputData } from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Validation result for final bidding player leave
 */
export interface FinalBiddingPlayerLeaveValidation {
  isEligible: boolean;
}

/**
 * Result of processing final bidding player leave
 */
export interface FinalBiddingPlayerLeaveMutationResult {
  bidAmount: number;
  playerId: number;
}

/**
 * Result of final bidding player leave operation
 */
export interface FinalBiddingPlayerLeaveResult {
  broadcasts: BroadcastEvent[];
  mutationResult: FinalBiddingPlayerLeaveMutationResult | null;
}

export interface FinalBiddingPlayerLeaveResultInput {
  game: Game;
  mutationResult: FinalBiddingPlayerLeaveMutationResult | null;
  transitionResult: TransitionResult | null;
}

/**
 * Pure business logic for handling player leaving during final round bidding phase.
 *
 * When a player leaves during final round bidding:
 * 1. Auto-bid minimum for them (so they can still participate if reconnecting)
 * 2. Try phase transition if all bids are now submitted
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class FinalBiddingPlayerLeaveLogic {
  /**
   * Validates if player leave logic should be applied.
   *
   * Conditions:
   * - Game must be in final round
   * - Game must be in BIDDING state
   * - Player must not have already submitted a bid
   * - Player must be eligible (in-game, player role)
   */
  public static validate(
    game: Game,
    userId: number
  ): FinalBiddingPlayerLeaveValidation {
    // Guard: Must be in final round bidding phase
    if (!TransitionGuards.isFinalRound(game)) {
      return { isEligible: false };
    }

    if (!TransitionGuards.isQuestionState(game, QuestionState.BIDDING)) {
      return { isEligible: false };
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      return { isEligible: false };
    }

    // Guard: Player must not have submitted bid yet
    if (TransitionGuards.hasPlayerSubmittedFinalBid(game, userId)) {
      return { isEligible: false };
    }

    // Guard: Player must be eligible (in-game, player role)
    if (!TransitionGuards.isPlayerEligible(game, userId)) {
      return { isEligible: false };
    }

    return { isEligible: true };
  }

  /**
   * Process auto-bid for leaving player.
   *
   * Uses minimum bid (not 0) so player can still participate if they reconnect,
   * without giving them an unfair advantage from the auto-bid.
   */
  public static processAutoBid(
    game: Game,
    userId: number
  ): FinalBiddingPlayerLeaveMutationResult {
    FinalRoundStateManager.addBid(game, userId, AUTO_BID_MINIMUM);

    return {
      bidAmount: AUTO_BID_MINIMUM,
      playerId: userId,
    };
  }

  /**
   * Builds the result object with broadcasts.
   */
  public static buildResult(
    input: FinalBiddingPlayerLeaveResultInput
  ): FinalBiddingPlayerLeaveResult {
    const { game, mutationResult, transitionResult } = input;
    const broadcasts: BroadcastEvent[] = [];

    if (!mutationResult) {
      return { broadcasts, mutationResult: null };
    }

    // Emit auto-bid event
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_BID_SUBMIT,
      data: {
        playerId: mutationResult.playerId,
        bidAmount: mutationResult.bidAmount,
        isAutomatic: true,
      } satisfies FinalBidSubmitOutputData,
      room: game.id,
    });

    // Add transition broadcasts if phase transition occurred
    if (transitionResult) {
      broadcasts.push(...transitionResult.broadcasts);
    }

    return { broadcasts, mutationResult };
  }
}
