import { STAKE_QUESTION_BID_TIME } from "domain/constants/game";
import {
  BiddingContext,
  BiddingTurn,
} from "domain/entities/game/values/BiddingTurn";
import { PlayerScore } from "domain/entities/game/values/PlayerScore";
import { StakeBid } from "domain/entities/game/values/StakeBid";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export interface BidValidationResult {
  isValid: boolean;
  errorMessage?: string;
  stakeBid?: StakeBid;
}

export interface PlaceBidParams {
  playerId: number;
  bid: number | StakeBidType;
  stakeData: StakeQuestionGameData;
  currentPlayer: PlayerDTO;
  questionPrice: number;
  allPlayers: PlayerDTO[];
}

export interface PlaceBidResult extends StakeBidSubmitOutputData {
  updatedStakeData: StakeQuestionGameData;
}

/**
 * Mapper class to encapsulate all STAKE question bidding logic
 * Provides clean, named functions for bidding operations
 */
export class StakeBiddingMapper {
  /**
   * Main function to place a bid with comprehensive validation and logic
   */
  public static placeBid(params: PlaceBidParams): PlaceBidResult {
    const {
      playerId,
      bid,
      stakeData,
      currentPlayer,
      questionPrice,
      allPlayers,
    } = params;

    // Check if any ALL_IN bids have been made previously
    const allInPlayers = BiddingTurn.getAllInPlayersFromStakeData(
      stakeData,
      allPlayers
    );

    // Validate the bid (including ALL_IN restrictions)
    const validation = this.validateBidAmount({
      bid,
      stakeData,
      currentPlayerScore: PlayerScore.create(currentPlayer.score),
      questionPrice,
      allInPlayers,
    });

    if (!validation.isValid) {
      throw new ClientError(
        ClientResponse.VALIDATION_ERROR,
        HttpStatus.BAD_REQUEST,
        {
          error: validation.errorMessage,
        }
      );
    }

    // Update stake data with the new bid
    const updatedStakeData = this.updateStakeDataWithBid({
      stakeData,
      playerId,
      stakeBid: validation.stakeBid!,
    });

    // Create BiddingTurn and determine next bidder
    const currentTurn = BiddingTurn.create(
      updatedStakeData.biddingOrder,
      updatedStakeData.currentBidderIndex
    );

    const biddingContext: BiddingContext = {
      stakeData: updatedStakeData,
      allPlayers,
    };

    const nextBidder = currentTurn.determineNext(biddingContext);

    // Update currentBidderIndex to point to the next bidder (if there is one)
    if (!nextBidder.isPhaseComplete && nextBidder.nextBidderId !== null) {
      updatedStakeData.currentBidderIndex =
        updatedStakeData.biddingOrder.indexOf(nextBidder.nextBidderId);
    }

    // Update biddingPhase flag if phase is complete
    if (nextBidder.isPhaseComplete) {
      updatedStakeData.biddingPhase = false;

      // Set the winner to the player with the highest bid
      if (updatedStakeData.highestBid !== null) {
        // Find the player who made the highest bid
        for (const [playerIdStr, bidAmount] of Object.entries(
          updatedStakeData.bids
        )) {
          if (bidAmount === updatedStakeData.highestBid) {
            updatedStakeData.winnerPlayerId = parseInt(playerIdStr, 10);
            break;
          }
        }
      }
    }

    // Create timer for next bid or null if phase complete
    const timer = nextBidder.isPhaseComplete ? null : this.createBidTimer();

    return {
      playerId,
      bidAmount: validation.stakeBid!.getAmount(),
      bidType: validation.stakeBid!.getType(),
      isPhaseComplete: nextBidder.isPhaseComplete,
      nextBidderId: nextBidder.nextBidderId,
      timer: timer || undefined,
      updatedStakeData,
    };
  }

  /**
   * Validates bid amount and determines bid type with proper ALL_IN logic
   */
  public static validateBidAmount(params: {
    bid: number | StakeBidType;
    stakeData: StakeQuestionGameData;
    currentPlayerScore: PlayerScore;
    questionPrice: number;
    allInPlayers: Set<number>;
  }): BidValidationResult {
    const { bid, stakeData, currentPlayerScore, questionPrice, allInPlayers } =
      params;

    // Handle special bid types
    if (ValueUtils.isString(bid)) {
      if (bid === StakeBidType.PASS) {
        // Validate that first bidder cannot pass if no bids have been made yet
        if (this.isFirstBidAttempt(stakeData)) {
          return {
            isValid: false,
            errorMessage: "First bidder cannot pass - must make an opening bid",
          };
        }

        return {
          isValid: true,
          stakeBid: StakeBid.pass(),
        };
      }

      if (bid === StakeBidType.ALL_IN) {
        const allInAmount = currentPlayerScore.getAllInAmount();

        if (this.exceedsMaxPrice(allInAmount, stakeData.maxPrice)) {
          return {
            isValid: false,
            errorMessage: `All-in bid (${allInAmount}) exceeds maximum price (${stakeData.maxPrice})`,
          };
        }

        if (this.isBelowQuestionPrice(allInAmount, questionPrice)) {
          return {
            isValid: false,
            errorMessage: `All-in bid (${allInAmount}) is below question price (${questionPrice})`,
          };
        }

        if (this.doesNotExceedHighestBid(allInAmount, stakeData.highestBid)) {
          return {
            isValid: false,
            errorMessage: `All-in bid (${allInAmount}) must be higher than current highest bid (${stakeData.highestBid})`,
          };
        }

        return {
          isValid: true,
          stakeBid: StakeBid.allIn(allInAmount),
        };
      }

      return {
        isValid: false,
        errorMessage: `Invalid bid type: ${bid}`,
      };
    }

    // Handle numeric bids validation
    const bidAmount = Number(bid);

    // Validate against question price (must be at least question price)
    if (this.isBelowQuestionPrice(bidAmount, questionPrice)) {
      return {
        isValid: false,
        errorMessage: `Bid amount (${bidAmount}) is below question price (${questionPrice})`,
      };
    }

    // If ANY player has gone ALL_IN, only PASS or ALL_IN bids are allowed
    if (this.hasAllInBids(allInPlayers)) {
      return {
        isValid: false,
        errorMessage:
          "After an all-in bid has been made, only all-in or pass bids are allowed",
      };
    }

    // Validate against player score
    if (!currentPlayerScore.canAfford(bidAmount)) {
      return {
        isValid: false,
        errorMessage: `Bid amount (${bidAmount}) exceeds player score (${currentPlayerScore.getAmount()})`,
      };
    }

    // Validate against maxPrice (if set)
    if (this.exceedsMaxPrice(bidAmount, stakeData.maxPrice)) {
      return {
        isValid: false,
        errorMessage: `Bid amount (${bidAmount}) exceeds maximum price (${stakeData.maxPrice})`,
      };
    }

    // Validate against current highest bid (must be higher than existing bids)
    if (this.doesNotExceedHighestBid(bidAmount, stakeData.highestBid)) {
      return {
        isValid: false,
        errorMessage: `Bid amount (${bidAmount}) must be higher than current highest bid (${stakeData.highestBid})`,
      };
    }

    // Determine bid type: ALL_IN if bidding entire score
    const bidType =
      bidAmount === currentPlayerScore.getAmount()
        ? StakeBidType.ALL_IN
        : StakeBidType.NORMAL;

    return {
      isValid: true,
      stakeBid:
        bidType === StakeBidType.ALL_IN
          ? StakeBid.allIn(bidAmount)
          : StakeBid.normal(bidAmount),
    };
  }

  /**
   * Updates stake data with a new bid
   */
  private static updateStakeDataWithBid(params: {
    stakeData: StakeQuestionGameData;
    playerId: number;
    stakeBid: StakeBid;
  }): StakeQuestionGameData {
    const { stakeData, playerId, stakeBid } = params;

    // Create updated stake data
    const updatedStakeData = { ...stakeData };

    if (stakeBid.isPass()) {
      // Add to passed players
      if (!updatedStakeData.passedPlayers.includes(playerId)) {
        updatedStakeData.passedPlayers.push(playerId);
      }
    } else {
      // Update bid record
      const bidAmount = stakeBid.getAmount()!;
      updatedStakeData.bids[playerId] = bidAmount;

      // Update highest bid if this is higher
      if (
        updatedStakeData.highestBid === null ||
        bidAmount > updatedStakeData.highestBid
      ) {
        updatedStakeData.highestBid = bidAmount;
        // Don't set winnerPlayerId here - only set it when bidding phase is complete
      }
    }

    return updatedStakeData;
  }

  /**
   * Checks if a player's bid constitutes a true ALL_IN
   */
  public static checkAllInStatus(params: {
    bidAmount: number;
    playerScore: number;
  }): boolean {
    const { bidAmount, playerScore } = params;

    // True ALL_IN: player is bidding their entire score
    // NOT just because they hit the maxPrice limit
    return bidAmount === playerScore;
  }

  /**
   * Determines if bidding phase is complete
   */
  public static isBiddingPhaseComplete(
    stakeData: StakeQuestionGameData,
    allPlayers?: PlayerDTO[]
  ): boolean {
    const currentTurn = BiddingTurn.create(
      stakeData.biddingOrder,
      stakeData.currentBidderIndex
    );

    const biddingContext: BiddingContext = {
      stakeData,
      allPlayers: allPlayers || [],
    };

    const nextBidder = currentTurn.determineNext(biddingContext);
    return nextBidder.isPhaseComplete;
  }

  /**
   * Creates a timer for the next bid
   */
  private static createBidTimer(): GameStateTimerDTO {
    return {
      durationMs: STAKE_QUESTION_BID_TIME,
      startedAt: new Date(),
      elapsedMs: 0,
    };
  }

  /**
   * Validation helper methods for better readability
   */

  /**
   * Checks if a bid amount exceeds the maximum price limit
   */
  private static exceedsMaxPrice(
    amount: number,
    maxPrice: number | null
  ): boolean {
    return maxPrice !== null && amount > maxPrice;
  }

  /**
   * Checks if a bid amount is below the minimum question price
   */
  private static isBelowQuestionPrice(
    amount: number,
    questionPrice: number
  ): boolean {
    return amount < questionPrice;
  }

  /**
   * Checks if a bid amount does not exceed the current highest bid
   * Once there's a highest bid, all subsequent bids must be strictly higher
   */
  private static doesNotExceedHighestBid(
    amount: number,
    highestBid: number | null
  ): boolean {
    // No highest bid yet - any bid >= question price is allowed (question price validation is handled separately)
    if (highestBid === null) {
      return false;
    }

    // Once there's a highest bid, all subsequent bids must be strictly higher
    return amount <= highestBid;
  }

  /**
   * Checks if this is the first bid attempt (no bids made yet)
   */
  private static isFirstBidAttempt(stakeData: StakeQuestionGameData): boolean {
    return (
      stakeData.highestBid === null && Object.keys(stakeData.bids).length === 0
    );
  }

  /**
   * Checks if any players have made ALL_IN bids
   */
  private static hasAllInBids(allInPlayers: Set<number>): boolean {
    return allInPlayers.size > 0;
  }
}
