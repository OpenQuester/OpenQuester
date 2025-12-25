import { Game } from "domain/entities/game/Game";

/**
 * Result of turn player change
 */
export interface TurnPlayerChangeResult {
  game: Game;
  newTurnPlayerId: number | null;
}

/**
 * Pure business logic for changing the current turn player.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export interface TurnPlayerChangeResultInput {
  game: Game;
  newTurnPlayerId: number | null;
}

export class TurnPlayerChangeLogic {
  /**
   * Apply turn player change.
   */
  public static applyTurnChange(
    game: Game,
    newTurnPlayerId: number | null
  ): void {
    game.gameState.currentTurnPlayerId = newTurnPlayerId;
  }

  /**
   * Builds the result object.
   */
  public static buildResult(
    input: TurnPlayerChangeResultInput
  ): TurnPlayerChangeResult {
    const { game, newTurnPlayerId } = input;
    return {
      game,
      newTurnPlayerId,
    };
  }
}
