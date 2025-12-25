import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
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
   * Build the result for stake bid submission.
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

    return {
      game,
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId,
      questionData: questionData?.question
        ? GameQuestionMapper.mapToSimpleQuestion(
            questionData.question as Parameters<
              typeof GameQuestionMapper.mapToSimpleQuestion
            >[0]
          )
        : null,
      timer,
    };
  }
}
