import { Game } from "domain/entities/game/Game";
import { GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { PasswordUtils } from "domain/utils/PasswordUtils";
import { ValueUtils } from "domain/utils/ValueUtils";

/**
 * Business logic for applying game updates.
 * Handles the mutation of game entity based on validated update data.
 */
export class GameUpdateLogic {
  /**
   * Applies basic field updates (title, privacy, age restriction, max players).
   */
  public static applyBasicUpdates(game: Game, updateData: GameUpdateDTO): void {
    if (ValueUtils.isString(updateData.title)) {
      game.title = updateData.title;
    }

    if (ValueUtils.isBoolean(updateData.isPrivate)) {
      game.isPrivate = updateData.isPrivate;
    }

    if (ValueUtils.isNumber(updateData.maxPlayers)) {
      game.maxPlayers = updateData.maxPlayers;
    }

    if (ValueUtils.isString(updateData.ageRestriction)) {
      game.ageRestriction = updateData.ageRestriction;
    }
  }

  /**
   * Applies password updates based on privacy rules:
   * - Public games: password is cleared
   * - Private games: use provided password or auto-generate if missing
   */
  public static applyPasswordUpdate(game: Game, updateData: GameUpdateDTO): void {
    if (!game.isPrivate) {
      game.password = null;
      return;
    }

    const isEmpty = ValueUtils.isEmpty(updateData.password);

    if (ValueUtils.isString(updateData.password) && !isEmpty) {
      game.password = updateData.password;
      return;
    }

    if (!ValueUtils.isString(game.gameState.password) || isEmpty) {
      game.password = PasswordUtils.generateGamePassword();
      return;
    }
  }
}
