import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PlayerRole } from "domain/types/game/PlayerRole";

export interface StakeQuestionContext {
  readonly game: Game;
  readonly currentPlayer: Player | null;
  readonly stakeData: StakeQuestionGameData | null;
  readonly allPlayers?: PlayerDTO[];
}

/**
 * Validator for stake question specific operations
 */
export class StakeQuestionValidator {
  /**
   * Validates stake question bid submission requirements
   * Allows showman to bid on behalf of current bidding player
   */
  public static validateBidSubmission(context: StakeQuestionContext): void {
    const { currentPlayer, stakeData } = context;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const isShowmanOverride = currentPlayer.role === PlayerRole.SHOWMAN;
    const isPlayer = currentPlayer.role === PlayerRole.PLAYER;

    if (!isShowmanOverride && !isPlayer) {
      throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
    }

    if (!stakeData) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    this._validatePlayerCanBid(stakeData, currentPlayer);
    this._validatePlayerTurn(stakeData, currentPlayer);
  }

  private static _validatePlayerCanBid(
    stakeData: StakeQuestionGameData,
    currentPlayer: Player
  ): void {
    if (stakeData.passedPlayers.includes(currentPlayer.meta.id)) {
      throw new ClientError(ClientResponse.PLAYER_ALREADY_PASSED);
    }
  }

  private static _validatePlayerTurn(
    stakeData: StakeQuestionGameData,
    currentPlayer: Player
  ): void {
    const currentBidderIndex = stakeData.currentBidderIndex;
    const currentBidderId = stakeData.biddingOrder[currentBidderIndex];

    if (currentPlayer.meta.id !== currentBidderId) {
      throw new ClientError(ClientResponse.NOT_YOUR_TURN);
    }
  }
}
