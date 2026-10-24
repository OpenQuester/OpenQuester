import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { PlayerScoreChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ClientError } from "domain/errors/ClientError";
import { ValueUtils } from "domain/utils/ValueUtils";

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
  public static applyScore(game: Game, targetPlayerId: number, newScore: number): number {
    // Offline players keep their seat and score, so the showman can still
    // correct it while they reconnect.
    const targetPlayer = game.getPlayer(targetPlayerId, {
      fetchDisconnected: true
    });

    if (!targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Clamp score to absolute limit
    const appliedScore = ValueUtils.clampAbs(newScore, SCORE_ABS_LIMIT);
    targetPlayer.score = appliedScore;

    return appliedScore;
  }

  /**
   * Builds the result object with broadcasts.
   */
  public static buildResult(input: PlayerScoreChangeResultInput): PlayerScoreChangeResult {
    const { game, targetPlayerId, newScore } = input;

    const broadcastData: PlayerScoreChangeBroadcastData = {
      playerId: targetPlayerId,
      newScore
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.SCORE_CHANGED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<PlayerScoreChangeBroadcastData>
    ];

    return {
      data: { game, targetPlayerId, newScore },
      broadcasts
    };
  }
}
