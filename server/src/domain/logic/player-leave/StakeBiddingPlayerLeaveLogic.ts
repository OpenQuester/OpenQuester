import { DEFAULT_QUESTION_PRICE } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";

/**
 * Validation result for stake bidding player leave
 */
export interface StakeBiddingPlayerLeaveValidation {
  isEligible: boolean;
}

/**
 * Result of processing stake bidding player leave
 */
export interface StakeBiddingPlayerLeaveMutationResult {
  playerId: number;
  winnerId: number | null;
  winningBid: number | null;
  isBiddingComplete: boolean;
  nextBidderId: number | null;
  questionSkipped: boolean;
}

/**
 * Result of stake bidding player leave operation
 */
export interface StakeBiddingPlayerLeaveResult {
  broadcasts: BroadcastEvent[];
  mutationResult: StakeBiddingPlayerLeaveMutationResult | null;
}

export interface StakeBiddingPlayerLeaveResultInput {
  game: Game;
  mutationResult: StakeBiddingPlayerLeaveMutationResult | null;
}

/**
 * Pure business logic for handling player leaving during stake question bidding phase.
 *
 * When a player leaves during stake bidding:
 * 1. Auto-pass for them
 * 2. Check remaining eligible bidders
 * 3. If only one bidder remains, they win
 * 4. If no bidders remain but there was a highest bid, that player wins
 * 5. Otherwise, skip the question
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class StakeBiddingPlayerLeaveLogic {
  /**
   * Validates if stake bidding player leave logic should be applied.
   *
   * Conditions:
   * - Game must have stake question data with active bidding phase
   * - Player must be in the bidding order
   * - Player must not have already passed
   */
  public static validate(
    game: Game,
    userId: number
  ): StakeBiddingPlayerLeaveValidation {
    const stakeData = game.gameState.stakeQuestionData;

    if (!stakeData || !stakeData.biddingPhase) {
      return { isEligible: false };
    }

    if (!stakeData.biddingOrder.includes(userId)) {
      return { isEligible: false };
    }

    if (stakeData.passedPlayers.includes(userId)) {
      return { isEligible: false };
    }

    return { isEligible: true };
  }

  /**
   * Process auto-pass for leaving player and determine bidding outcome.
   */
  public static processAutoPass(
    game: Game,
    userId: number
  ): StakeBiddingPlayerLeaveMutationResult {
    const stakeData = game.gameState.stakeQuestionData!;

    // Auto-pass for the leaving player
    stakeData.passedPlayers.push(userId);
    stakeData.bids[userId] = null;

    // Check remaining eligible bidders (not passed, still in game, not leaving)
    const remainingBidders = stakeData.biddingOrder.filter(
      (playerId) =>
        !stakeData.passedPlayers.includes(playerId) &&
        playerId !== userId &&
        game.hasPlayer(playerId)
    );

    let winnerId: number | null = null;
    let winningBid: number | null = null;
    let isBiddingComplete = false;
    let nextBidderId: number | null = null;
    let questionSkipped = false;

    // If only one bidder remains or no bidders remain, end bidding phase
    if (remainingBidders.length <= 1) {
      stakeData.biddingPhase = false;
      isBiddingComplete = true;

      if (remainingBidders.length === 1) {
        // Last remaining player wins
        winnerId = remainingBidders[0];

        // If they haven't bid yet, they get minimum bid (question price)
        if (stakeData.bids[winnerId] === undefined) {
          const questionData = GameQuestionMapper.getQuestionAndTheme(
            game.package,
            game.gameState.currentRound!.id,
            stakeData.questionId
          );
          stakeData.bids[winnerId] =
            questionData?.question.price || DEFAULT_QUESTION_PRICE;
          stakeData.highestBid = stakeData.bids[winnerId];
        }
        winningBid = stakeData.highestBid;
        stakeData.winnerPlayerId = winnerId;
      } else if (stakeData.highestBid !== null) {
        // No remaining bidders but there was a highest bid - that player wins
        for (const [playerIdStr, bidAmount] of Object.entries(stakeData.bids)) {
          if (bidAmount === stakeData.highestBid) {
            winnerId = parseInt(playerIdStr, 10);
            winningBid = stakeData.highestBid;
            stakeData.winnerPlayerId = winnerId;
            break;
          }
        }
      } else {
        // No winner - question should be skipped
        questionSkipped = true;
      }
    } else {
      // Find next eligible bidder
      nextBidderId = StakeBiddingPlayerLeaveLogic._findNextEligibleBidder(
        stakeData.biddingOrder,
        stakeData.currentBidderIndex,
        stakeData.passedPlayers,
        userId
      );

      if (nextBidderId !== null) {
        stakeData.currentBidderIndex =
          stakeData.biddingOrder.indexOf(nextBidderId);
      }
    }

    game.gameState.stakeQuestionData = stakeData;

    return {
      playerId: userId,
      winnerId,
      winningBid,
      isBiddingComplete,
      nextBidderId,
      questionSkipped,
    };
  }

  /**
   * Handle question skip when no winner determined.
   * Clears stake data and moves to choosing state.
   */
  public static handleQuestionSkip(game: Game): void {
    game.gameState.stakeQuestionData = null;
    game.gameState.questionState = QuestionState.CHOOSING;
  }

  /**
   * Builds the result object with broadcasts.
   */
  public static buildResult(
    input: StakeBiddingPlayerLeaveResultInput
  ): StakeBiddingPlayerLeaveResult {
    const { game, mutationResult } = input;
    const broadcasts: BroadcastEvent[] = [];

    if (!mutationResult) {
      return { broadcasts, mutationResult: null };
    }

    // Emit the auto-pass bid event
    broadcasts.push({
      event: SocketIOGameEvents.STAKE_BID_SUBMIT,
      data: {
        playerId: mutationResult.playerId,
        bidAmount: null,
        bidType: StakeBidType.PASS,
        isPhaseComplete: mutationResult.isBiddingComplete,
        nextBidderId: mutationResult.nextBidderId,
      } satisfies StakeBidSubmitOutputData,
      room: game.id,
    });

    // Emit winner event if there's a winner
    if (mutationResult.winnerId !== null) {
      broadcasts.push({
        event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
        data: {
          winnerPlayerId: mutationResult.winnerId,
          finalBid: mutationResult.winningBid,
        } satisfies StakeQuestionWinnerEventData,
        room: game.id,
      });
    }

    return { broadcasts, mutationResult };
  }

  /**
   * Find the next eligible bidder in circular bidding order.
   */
  private static _findNextEligibleBidder(
    biddingOrder: number[],
    currentIndex: number,
    passedPlayers: number[],
    excludePlayerId: number
  ): number | null {
    const totalPlayers = biddingOrder.length;

    for (let offset = 1; offset <= totalPlayers; offset++) {
      const candidateIndex = (currentIndex + offset) % totalPlayers;
      const candidatePlayerId = biddingOrder[candidateIndex];

      const isPassed = passedPlayers.includes(candidatePlayerId);
      const isExcluded = candidatePlayerId === excludePlayerId;

      if (!isPassed && !isExcluded) {
        return candidatePlayerId;
      }
    }

    return null;
  }
}
