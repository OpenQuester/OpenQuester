import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PlayerScoreChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Data from player score change
 */
export interface PlayerScoreChangeData {
  game: Game;
  targetPlayerId: number;
  newScore: number;
}

/**
 * Result of player score change with broadcasts
 */
export interface PlayerScoreChangeResult {
  data: PlayerScoreChangeData;
  broadcasts: SocketEventBroadcast[];
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
   * Builds the result object with broadcasts.
   */
  public static buildResult(
    input: PlayerScoreChangeResultInput
  ): PlayerScoreChangeResult {
    const { game, targetPlayerId, newScore } = input;

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: targetPlayerId,
      newScore,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.SCORE_CHANGED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<PlayerScoreChangeBroadcastData>,
    ];

    return {
      data: { game, targetPlayerId, newScore },
      broadcasts,
    };
  }
}
