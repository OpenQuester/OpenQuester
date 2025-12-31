import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Result of player score change
 */
export interface PlayerScoreChangeResult {
  game: Game;
  targetPlayerId: number;
  newScore: number;
}

interface PlayerScoreChangeResultInput {
  game: Game;
  targetPlayerId: number;
  newScore: number;
}

/**
 * Pure business logic for changing player score.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class PlayerScoreChangeLogic {
  /**
   * Apply score change to player with clamping.
   *
   * @returns The actually applied score (after clamping)
   */
  public static applyScore(
    game: Game,
    targetPlayerId: number,
    newScore: number
  ): number {
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: false,
    });

    if (!targetPlayer) {
      throw new Error(`Player ${targetPlayerId} not found`);
    }

    // Clamp score to absolute limit
    const appliedScore = ValueUtils.clampAbs(newScore, SCORE_ABS_LIMIT);
    targetPlayer.score = appliedScore;

    return appliedScore;
  }

  /**
   * Builds the result object.
   */
  public static buildResult(
    input: PlayerScoreChangeResultInput
  ): PlayerScoreChangeResult {
    const { game, targetPlayerId, newScore } = input;

    return {
      game,
      targetPlayerId,
      newScore,
    };
  }
}
