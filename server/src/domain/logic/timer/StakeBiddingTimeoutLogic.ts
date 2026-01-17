import { DEFAULT_QUESTION_PRICE } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { BiddingTurn } from "domain/entities/game/values/BiddingTurn";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  StakeBiddingTimeoutMutationResult,
  StakeBiddingTimeoutResult,
  StakeBiddingTimeoutResultInput,
} from "domain/types/socket/question/StakeQuestionResults";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * Pure logic for handling stake bidding timer expiration.
 */
export class StakeBiddingTimeoutLogic {
  /**
   * Returns true when current game state represents stake bidding (not final round).
   */
  public static isStakeBiddingExpiration(game: Game | null): boolean {
    if (!game) return false;

    return (
      game.gameState?.stakeQuestionData?.biddingPhase === true &&
      game.gameState?.questionState === QuestionState.BIDDING &&
      game.gameState?.finalRoundData == null
    );
  }

  /**
   * Processes timeout: first bidder auto-bids minimum, others auto-pass.
   */
  public static processTimeout(game: Game): StakeBiddingTimeoutMutationResult {
    const stakeData = game.gameState.stakeQuestionData!;
    const allPlayers = game.getInGamePlayers().map((player) => player.toDTO());
    const currentBidderId =
      stakeData.biddingOrder[stakeData.currentBidderIndex];

    // Determine minimum bid (question price or default fallback)
    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      stakeData.questionId
    );
    const questionPrice =
      questionData?.question.price ?? DEFAULT_QUESTION_PRICE;

    const isFirstBid = this.isFirstBidAttempt(stakeData);

    let bidType: StakeBidType;
    let bidAmount: number | null = null;

    if (isFirstBid) {
      // First bidder cannot pass: place minimal allowed bid (question price)
      bidType = StakeBidType.NORMAL;
      bidAmount = questionPrice;
      stakeData.bids[currentBidderId] = bidAmount;
      stakeData.highestBid = bidAmount;
    } else {
      // Non-first bidders time out as PASS
      bidType = StakeBidType.PASS;
      bidAmount = null;

      if (!stakeData.passedPlayers.includes(currentBidderId)) {
        stakeData.passedPlayers.push(currentBidderId);
      }

      if (stakeData.bids[currentBidderId] === undefined) {
        stakeData.bids[currentBidderId] = null;
      }
    }

    // Determine next bidder / completion using existing turn logic
    const turn = BiddingTurn.create(
      stakeData.biddingOrder,
      stakeData.currentBidderIndex
    );

    const nextBidderData = turn.determineNext({ stakeData, allPlayers });

    if (nextBidderData.isPhaseComplete) {
      const winnerPlayerId =
        nextBidderData.winnerPlayerId ?? this.findHighestBidder(stakeData);

      if (winnerPlayerId !== null) {
        stakeData.winnerPlayerId = winnerPlayerId;
      }
    } else if (nextBidderData.nextBidderId !== null) {
      stakeData.currentBidderIndex = stakeData.biddingOrder.indexOf(
        nextBidderData.nextBidderId
      );
    }

    game.gameState.stakeQuestionData = stakeData;

    return {
      currentBidderId,
      bidType,
      bidAmount,
      isPhaseComplete: nextBidderData.isPhaseComplete,
      nextBidderId: nextBidderData.nextBidderId,
      winnerPlayerId: stakeData.winnerPlayerId,
      highestBid: stakeData.highestBid,
    };
  }

  /**
   * Builds result with broadcasts for socket emission.
   */
  public static buildResult(
    input: StakeBiddingTimeoutResultInput
  ): StakeBiddingTimeoutResult {
    const { game, mutationResult, transitionResult, timer } = input;

    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: {
          playerId: mutationResult.currentBidderId,
          bidAmount: mutationResult.bidAmount,
          bidType: mutationResult.bidType,
          isPhaseComplete: mutationResult.isPhaseComplete,
          nextBidderId: mutationResult.nextBidderId,
          // Timer only relevant when bidding continues
          ...(mutationResult.isPhaseComplete ? {} : { timer }),
        } satisfies StakeBidSubmitOutputData,
        room: game.id,
      },
    ];

    if (transitionResult) {
      broadcasts.push(...transitionResult.broadcasts);
    }

    return { mutationResult, transitionResult, broadcasts };
  }

  private static isFirstBidAttempt(stakeData: StakeQuestionGameData): boolean {
    return (
      stakeData.highestBid === null && Object.keys(stakeData.bids).length === 0
    );
  }

  private static findHighestBidder(
    stakeData: StakeQuestionGameData
  ): number | null {
    for (const [playerIdStr, bidAmount] of Object.entries(stakeData.bids)) {
      if (bidAmount !== null && bidAmount === stakeData.highestBid) {
        return parseInt(playerIdStr, 10);
      }
    }

    return null;
  }
}
