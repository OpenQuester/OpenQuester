import { Game } from "domain/entities/game/Game";

export interface PlayerReadinessResult {
  game: Game;
  playerId: number;
  isReady: boolean;
  readyPlayers: number[];
  shouldAutoStart: boolean;
}

interface PlayerReadinessResultInput {
  game: Game;
  playerId: number;
  isReady: boolean;
  readyPlayers: number[];
  shouldAutoStart: boolean;
}

/**
 * Logic class for handling player readiness state management.
 * Manages ready state transitions and auto-start detection.
 */
export class PlayerReadinessLogic {
  /**
   * Update player ready state by adding or removing from ready list.
   */
  public static updateReadyState(
    game: Game,
    playerId: number,
    isReady: boolean
  ): number[] {
    const currentReadyPlayers = game.gameState.readyPlayers || [];

    let newReadyPlayers: number[];
    if (isReady) {
      // Add player to ready list if not already present
      newReadyPlayers = currentReadyPlayers.includes(playerId)
        ? currentReadyPlayers
        : [...currentReadyPlayers, playerId];
    } else {
      // Remove player from ready list
      newReadyPlayers = currentReadyPlayers.filter((id) => id !== playerId);
    }

    game.gameState.readyPlayers = newReadyPlayers;
    return newReadyPlayers;
  }

  /**
   * Check if all players are ready for auto-start.
   */
  public static shouldAutoStart(game: Game): boolean {
    return game.isEveryoneReady();
  }

  /**
   * Build result for player readiness operation.
   */
  public static buildResult(
    input: PlayerReadinessResultInput
  ): PlayerReadinessResult {
    const { game, playerId, isReady, readyPlayers, shouldAutoStart } = input;

    return {
      game,
      playerId,
      isReady,
      readyPlayers,
      shouldAutoStart,
    };
  }
}
