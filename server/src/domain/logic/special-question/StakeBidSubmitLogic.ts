import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { StakeBidSubmitResult } from "domain/types/socket/question/StakeQuestionResults";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export interface StakeBidProcessResult {
  playerId: number;
  bidAmount: number;
  bidType: StakeBidType;
  isPhaseComplete: boolean;
  nextBidderId: number | null;
  winnerPlayerId: number | null;
}

export interface StakeBidSubmitBuildResultInput {
  game: Game;
  playerId: number;
  bidAmount: number | null;
  bidType: StakeBidType;
  isPhaseComplete: boolean;
  nextBidderId: number | null;
  winnerPlayerId: number | null;
  questionData: { question: { id?: number } } | null | undefined;
  timer: GameStateTimerDTO | undefined;
}

/**
 * Logic class for handling stake bid submission processing.
 * Extracts business logic from SpecialQuestionService.handleStakeBidSubmit.
 */
export class StakeBidSubmitLogic {
  /**
   * Resolve the bidding player from current player or showman override.
   */
  public static resolveBiddingPlayer(
    game: Game,
    currentPlayer: Player,
    stakeData: StakeQuestionGameData
  ): Player {
    const isShowmanOverride = currentPlayer.role === PlayerRole.SHOWMAN;

    if (!isShowmanOverride) {
      return currentPlayer;
    }

    const currentBidderIndex = stakeData.currentBidderIndex;

    if (
      !ValueUtils.isNumber(currentBidderIndex) ||
      currentBidderIndex < 0 ||
      currentBidderIndex >= stakeData.biddingOrder.length
    ) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const biddingPlayerId = stakeData.biddingOrder[currentBidderIndex];
    const targetPlayer = game.getPlayer(biddingPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    return targetPlayer;
  }

  /**
   * Build the result for stake bid submission with broadcasts.
   */
  public static buildResult(
    input: StakeBidSubmitBuildResultInput
  ): StakeBidSubmitResult {
    const {
      game,
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId,
      questionData,
      timer,
    } = input;

    const mappedQuestionData = questionData?.question
      ? GameQuestionMapper.mapToSimpleQuestion(
          questionData.question as Parameters<
            typeof GameQuestionMapper.mapToSimpleQuestion
          >[0]
        )
      : null;

    const outputData: StakeBidSubmitOutputData = {
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      timer,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<StakeBidSubmitOutputData>,
    ];

    // If bidding phase is complete, announce winner and start question
    if (isPhaseComplete && winnerPlayerId && mappedQuestionData && timer) {
      const finalBid = game.gameState.stakeQuestionData?.highestBid || null;

      broadcasts.push({
        event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
        data: {
          winnerPlayerId,
          finalBid,
        } satisfies StakeQuestionWinnerEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<StakeQuestionWinnerEventData>);

      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: mappedQuestionData,
          timer,
        } satisfies GameQuestionDataEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<GameQuestionDataEventPayload>);
    }

    return {
      data: outputData,
      broadcasts,
      game,
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId,
      questionData: mappedQuestionData,
      timer,
    };
  }
}
