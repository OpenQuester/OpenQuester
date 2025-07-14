import { Game } from "domain/entities/game/Game";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";

/**
 * Utility class for managing player turns in final round theme elimination
 * Handles turn-based progression starting from random/first player
 */
export class FinalRoundTurnManager {
  /**
   * Get all eligible players for theme elimination (excluding showman and spectators)
   */
  public static getEligiblePlayers(game: Game) {
    return game.players.filter(
      (player) =>
        player.role === PlayerRole.PLAYER &&
        player.gameStatus === PlayerGameStatus.IN_GAME
    );
  }

  /**
   * Initialize theme elimination turn order
   * Starts with a random player or first player if randomization fails
   */
  public static initializeTurnOrder(game: Game): number[] {
    const eligiblePlayers = this.getEligiblePlayers(game);

    if (eligiblePlayers.length === 0) {
      return [];
    }

    // Create array of player IDs
    const playerIds = eligiblePlayers.map((p) => p.meta.id);

    // Shuffle to randomize starting player
    const shuffled = [...playerIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Get the current player whose turn it is to eliminate a theme
   * Based on number of themes already eliminated
   */
  public static getCurrentTurnPlayer(
    game: Game,
    turnOrder: number[]
  ): number | null {
    if (!game.gameState.currentRound || turnOrder.length === 0) {
      return null;
    }

    // Count eliminated themes (themes with played questions)
    const eliminatedThemes = game.gameState.currentRound.themes.filter(
      (theme) => theme.questions?.some((q) => q.isPlayed)
    );

    const turnIndex = eliminatedThemes.length % turnOrder.length;
    return turnOrder[turnIndex];
  }

  /**
   * Check if it's a specific player's turn to eliminate a theme
   */
  public static isPlayerTurn(
    game: Game,
    playerId: number,
    turnOrder: number[]
  ): boolean {
    const currentTurnPlayer = this.getCurrentTurnPlayer(game, turnOrder);
    return currentTurnPlayer === playerId;
  }

  /**
   * Get remaining active themes that can be eliminated
   */
  public static getActiveThemes(game: Game) {
    if (!game.gameState.currentRound) {
      return [];
    }

    return game.gameState.currentRound.themes.filter(
      (theme) => !theme.questions?.some((q) => q.isPlayed)
    );
  }
}
