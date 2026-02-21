import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";

export interface BiddingContext {
  stakeData: StakeQuestionGameData;
  allPlayers: PlayerDTO[];
}

interface NextBidderResult {
  nextBidderId: number | null;
  isPhaseComplete: boolean;
  winnerPlayerId?: number | null;
}

/**
 * Value class representing the current state of bidding turns in a stake question.
 * Encapsulates turn order management and next bidder determination logic.
 */
export class BiddingTurn {
  private constructor(
    private readonly biddingOrder: number[],
    private readonly currentIndex: number
  ) {
    //
  }

  public static create(
    biddingOrder: number[],
    currentIndex: number
  ): BiddingTurn {
    return new BiddingTurn([...biddingOrder], currentIndex);
  }

  public getCurrentBidderId(): number {
    return this.biddingOrder[this.currentIndex];
  }

  /**
   * Determines the next bidder and phase completion status
   */
  public determineNext(context: BiddingContext): NextBidderResult {
    const { stakeData } = context;

    if (this._isMaxPriceReached(stakeData)) {
      return this._createCompleteResult(stakeData.winnerPlayerId);
    }

    const eligibilityData = this._calculatePlayersEligibility(context);

    if (eligibilityData.playersWhoCanStillAct === 0) {
      return this._createCompleteResult(stakeData.winnerPlayerId);
    }

    if (this._isSinglePlayerRemaining(eligibilityData, stakeData)) {
      const winnerPlayerId = this._findHighestBidder(stakeData);
      return this._createCompleteResult(winnerPlayerId);
    }

    const nextBidderId = this._findNextEligiblePlayer(
      eligibilityData.eligibleForNextBid
    );

    return nextBidderId
      ? { nextBidderId, isPhaseComplete: false }
      : this._createCompleteResult(stakeData.winnerPlayerId);
  }

  /**
   * Gets all players who have made ALL_IN bids from the stake data
   */
  public static getAllInPlayersFromStakeData(
    stakeData: StakeQuestionGameData,
    allPlayers: PlayerDTO[]
  ): Set<number> {
    const allInPlayers = new Set<number>();
    const playerScoreMap = new Map<number, number>();

    allPlayers.forEach((player) => {
      playerScoreMap.set(player.meta.id, player.score);
    });

    for (const [playerIdStr, bidAmount] of Object.entries(stakeData.bids)) {
      const playerId = parseInt(playerIdStr, 10);
      const playerScore = playerScoreMap.get(playerId);

      if (playerScore !== undefined && bidAmount === playerScore) {
        allInPlayers.add(playerId);
      }
    }

    return allInPlayers;
  }

  private _isMaxPriceReached(stakeData: StakeQuestionGameData): boolean {
    return (
      stakeData.maxPrice !== null && stakeData.highestBid === stakeData.maxPrice
    );
  }

  /**
   * Creates a result indicating the bidding phase is complete with provided winner
   */
  private _createCompleteResult(
    winnerPlayerId: number | null = null
  ): NextBidderResult {
    return {
      nextBidderId: null,
      isPhaseComplete: true,
      winnerPlayerId,
    };
  }

  /**
   * Calculates which players are eligible to bid and how many can still act meaningfully.
   *
   * A player is eligible for next bid ONLY if they can actually outbid the current highest.
   * If a player can only PASS (cannot afford to outbid), they are not added to eligibleForNextBid.
   * This ensures bidding completes immediately when no one can outbid the current leader.
   */
  private _calculatePlayersEligibility(context: BiddingContext): {
    playersWhoCanStillAct: number;
    eligibleForNextBid: number[];
  } {
    const { stakeData, allPlayers } = context;
    const { passedPlayers } = stakeData;
    const allInPlayers = BiddingTurn.getAllInPlayersFromStakeData(
      stakeData,
      allPlayers
    );
    const hasAllInBids = allInPlayers.size > 0;

    let playersWhoCanStillAct = 0;
    const eligibleForNextBid: number[] = [];

    for (const playerId of this.biddingOrder) {
      if (
        this._hasPlayerPassed(playerId, passedPlayers) ||
        this._hasPlayerAlreadyWentAllIn(playerId, stakeData, allPlayers)
      ) {
        // Cannot bid. You can pass or ALL_IN only once.
        continue;
      }

      const player = allPlayers.find((p) => p.meta.id === playerId);
      if (!player) {
        // No player data found, assume they cannot bid
        continue;
      }

      // TODO: Refactor, move to logic class
      if (hasAllInBids) {
        // After ALL_IN bid(s), only players who can match or exceed the ALL_IN can continue
        // Check if player can go ALL_IN with score >= current highest bid
        const canMatchAllIn =
          stakeData.highestBid !== null && player.score > stakeData.highestBid;

        if (canMatchAllIn) {
          playersWhoCanStillAct++;
          eligibleForNextBid.push(playerId);
        }
        // Players who cannot match ALL_IN are effectively out (can only PASS)
      } else if (stakeData.highestBid !== null) {
        // Only add players who can meaningfully outbid
        const minBidRequired = stakeData.highestBid + 1;

        if (player.score >= minBidRequired) {
          playersWhoCanStillAct++;
          eligibleForNextBid.push(playerId);
        }
        // Players who cannot outbid are not eligible (would only PASS anyway)
      } else {
        // No highest bid yet, everyone can participate
        playersWhoCanStillAct++;
        eligibleForNextBid.push(playerId);
      }
    }

    return { playersWhoCanStillAct, eligibleForNextBid };
  }

  /**
   * Checks if only one player remains and they already have the highest bid
   * This prevents unnecessary bidding when the outcome is already determined
   */
  private _isSinglePlayerRemaining(
    eligibilityData: {
      playersWhoCanStillAct: number;
      eligibleForNextBid: number[];
    },
    stakeData: StakeQuestionGameData
  ): boolean {
    const { playersWhoCanStillAct, eligibleForNextBid } = eligibilityData;

    if (
      playersWhoCanStillAct > 1 ||
      stakeData.highestBid === null ||
      eligibleForNextBid.length > 1
    ) {
      return false;
    }

    const onlyEligiblePlayer = eligibleForNextBid[0];
    const currentHighestBidder = this._findHighestBidder(stakeData);

    return onlyEligiblePlayer === currentHighestBidder;
  }

  /**
   * Finds the player who made the highest bid
   */
  private _findHighestBidder(stakeData: StakeQuestionGameData): number | null {
    for (const [playerIdStr, bidAmount] of Object.entries(stakeData.bids)) {
      if (bidAmount === stakeData.highestBid) {
        return parseInt(playerIdStr, 10);
      }
    }
    return null;
  }

  /**
   * Finds the next eligible player in the bidding order
   */
  private _findNextEligiblePlayer(eligibleForNextBid: number[]): number | null {
    // Create a rotated view starting from the next player
    const nextPlayerIndex = (this.currentIndex + 1) % this.biddingOrder.length;

    // Example: If currentIndex is 2 and biddingOrder is [1, 2, 3, 4],
    // nextPlayerIndex will be 3, and the rotated order will be [4, 1, 2, 3]
    const rotatedOrder = [
      ...this.biddingOrder.slice(nextPlayerIndex),
      ...this.biddingOrder.slice(0, nextPlayerIndex),
    ];

    // Find the first eligible player in the rotated order
    return (
      rotatedOrder.find((playerId) => eligibleForNextBid.includes(playerId)) ??
      null
    );
  }

  private _hasPlayerPassed(playerId: number, passedPlayers: number[]): boolean {
    return passedPlayers.includes(playerId);
  }

  /**
   * Checks if a player has already bid their entire score (went ALL_IN)
   * Once a player goes ALL_IN, they cannot bid again in this question
   */
  private _hasPlayerAlreadyWentAllIn(
    playerId: number,
    stakeData: StakeQuestionGameData,
    allPlayers: PlayerDTO[]
  ): boolean {
    const playerCurrentBid = stakeData.bids[playerId];
    if (playerCurrentBid === undefined || allPlayers.length === 0) {
      return false;
    }

    const player = allPlayers.find((p) => p.meta.id === playerId);
    return player ? playerCurrentBid === player.score : false;
  }
}
