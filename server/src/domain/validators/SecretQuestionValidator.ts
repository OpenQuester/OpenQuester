import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

export interface SecretQuestionContext {
  readonly game: Game;
  readonly currentPlayer: Player | null;
  readonly secretData: SecretQuestionGameData | null;
  readonly targetPlayerId?: number;
}

/**
 * Validator for secret question specific operations
 */
export class SecretQuestionValidator {
  /**
   * Validates secret question transfer requirements
   * Allows showman to transfer on behalf of picker player
   */
  public static validateTransfer(context: SecretQuestionContext): void {
    const { game, currentPlayer, secretData, targetPlayerId } = context;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    if (game.gameState.questionState !== QuestionState.SECRET_TRANSFER) {
      throw new ClientError(ClientResponse.GAME_NOT_IN_SECRET_TRANSFER_PHASE);
    }

    if (!secretData) {
      throw new ClientError(ClientResponse.SECRET_QUESTION_DATA_NOT_FOUND);
    }

    const isShowmanOverride = currentPlayer.role === PlayerRole.SHOWMAN;
    const isPickerPlayer = secretData.pickerPlayerId === currentPlayer.meta.id;

    if (!isShowmanOverride && !isPickerPlayer) {
      throw new ClientError(ClientResponse.CANNOT_TRANSFER_SECRET_QUESTION);
    }

    if (
      !isShowmanOverride &&
      !game.isPlayerEligibleToAnswer(currentPlayer.meta.id)
    ) {
      throw new ClientError(
        ClientResponse.YOU_CANNOT_PARTICIPATE_IN_CURRENT_QUESTION
      );
    }

    if (targetPlayerId !== undefined) {
      this._validateTransferTarget(game, secretData, targetPlayerId);
    }
  }

  private static _validateTransferTarget(
    game: Game,
    secretData: SecretQuestionGameData,
    targetPlayerId: number
  ): void {
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer || targetPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.INVALID_TRANSFER_TARGET);
    }

    if (!game.isPlayerEligibleToAnswer(targetPlayerId)) {
      throw new ClientError(
        ClientResponse.YOU_CANNOT_PARTICIPATE_IN_CURRENT_QUESTION
      );
    }

    if (
      secretData.transferType === PackageQuestionTransferType.EXCEPT_CURRENT &&
      targetPlayerId === secretData.pickerPlayerId
    ) {
      throw new ClientError(ClientResponse.CANNOT_TRANSFER_TO_SELF);
    }
  }
}
