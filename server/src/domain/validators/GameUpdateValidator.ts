import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Validator for game update operations.
 * Handles all validation rules for REST-driven game updates.
 */
export class GameUpdateValidator {
  /**
   * Validates that the user has permission to update the game.
   * User must be either the host or the showman.
   */
  public static validateUpdatePermission(game: Game, userId: number): void {
    const currentPlayer = game.getPlayer(userId, { fetchDisconnected: true });
    const isShowman = currentPlayer?.role === PlayerRole.SHOWMAN;

    if (!isShowman) {
      throw new ClientError(ClientResponse.NO_PERMISSION, HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Validates password update rules:
   * 1) Public games cannot accept password field
   * 2) Private games cannot remove password via null
   */
  public static validatePasswordUpdate(
    updateData: GameUpdateDTO,
    currentIsPrivate: boolean
  ): void {
    const targetIsPrivate = ValueUtils.isBoolean(updateData.isPrivate)
      ? updateData.isPrivate
      : currentIsPrivate;

    // Rule 2: Private games cannot remove password
    if (targetIsPrivate && updateData.password === null) {
      throw new ClientError(
        ClientResponse.GAME_PASSWORD_CANNOT_BE_REMOVED_FOR_PRIVATE_GAME,
        HttpStatus.BAD_REQUEST
      );
    }

    const passwordProvided =
      !ValueUtils.isBad(updateData.password) &&
      ValueUtils.isString(updateData.password) &&
      !ValueUtils.isEmpty(updateData.password);

    if (!passwordProvided) {
      return;
    }

    // Rule 1: Public games cannot have password
    if (!targetIsPrivate) {
      throw new ClientError(
        ClientResponse.GAME_PASSWORD_NOT_ALLOWED_FOR_PUBLIC_GAME,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Validates that package can only be changed before game starts.
   */
  public static validatePackageUpdate(
    updateData: GameUpdateDTO,
    game: Game
  ): void {
    if (!ValueUtils.isNumber(updateData.packageId)) {
      return;
    }

    const gameStarted = ValueUtils.isValidDate(game.startedAt);
    if (gameStarted) {
      throw new ClientError(
        ClientResponse.GAME_STATED_CANNOT_CHANGE_PACKAGE,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Validates that maxPlayers is not reduced below current player count.
   */
  public static validateMaxPlayersUpdate(
    updateData: GameUpdateDTO,
    game: Game
  ): void {
    if (!ValueUtils.isNumber(updateData.maxPlayers)) {
      return;
    }

    const inGamePlayersCount = game.getInGamePlayers().length;
    if (updateData.maxPlayers < inGamePlayersCount) {
      throw new ClientError(
        ClientResponse.CANNOT_SET_MAX_PLAYERS_BELOW_CURRENT,
        HttpStatus.BAD_REQUEST,
        {
          maxPlayers: updateData.maxPlayers,
          playersCount: inGamePlayersCount,
        }
      );
    }
  }
}
