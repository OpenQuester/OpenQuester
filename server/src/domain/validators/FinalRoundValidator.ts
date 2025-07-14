import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

/**
 * Validator for final round specific operations
 */
export class FinalRoundValidator {
  /**
   * Validates that the current player can perform final round actions
   */
  public static validateFinalRoundPlayer(currentPlayer: Player): void {
    if (currentPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
    }
  }

  /**
   * Validates that the current player can eliminate themes (players or showman)
   */
  public static validateThemeEliminationPlayer(currentPlayer: Player): void {
    if (
      currentPlayer.role !== PlayerRole.PLAYER &&
      currentPlayer.role !== PlayerRole.SHOWMAN
    ) {
      throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
    }
  }

  /**
   * Validates that the game is in the theme elimination phase
   */
  public static validateThemeEliminationPhase(game: Game): void {
    this._validateFinalRound(game);

    if (game.gameState.questionState !== QuestionState.THEME_ELIMINATION) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
  }

  /**
   * Validates that the game is in the bidding phase
   */
  public static validateBiddingPhase(game: Game): void {
    this._validateFinalRound(game);

    if (game.gameState.questionState !== QuestionState.BIDDING) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
  }

  /**
   * Validates that the game is in the reviewing phase
   */
  public static validateReviewingPhase(game: Game): void {
    this._validateFinalRound(game);

    if (game.gameState.questionState !== QuestionState.REVIEWING) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
  }

  /**
   * Validates that the game is in final round
   */
  private static _validateFinalRound(game: Game): void {
    if (
      !game.gameState.currentRound ||
      game.gameState.currentRound.type !== PackageRoundType.FINAL
    ) {
      throw new ClientError(ClientResponse.INVALID_ROUND_TYPE);
    }
  }
}
