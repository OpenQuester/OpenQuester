import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { TurnPlayerChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Data of turn player change
 */
export interface TurnPlayerChangeData {
  game: Game;
  newTurnPlayerId: number | null;
}

/**
 * Result of turn player change with broadcasts
 */
export interface TurnPlayerChangeResult {
  data: TurnPlayerChangeData;
  broadcasts: SocketEventBroadcast[];
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
   * Builds the result object with broadcasts.
   */
  public static buildResult(
    input: TurnPlayerChangeResultInput
  ): TurnPlayerChangeResult {
    const { game, newTurnPlayerId } = input;

    const broadcastData: TurnPlayerChangeBroadcastData = { newTurnPlayerId };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.TURN_PLAYER_CHANGED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<TurnPlayerChangeBroadcastData>,
    ];

    return {
      data: { game, newTurnPlayerId },
      broadcasts,
    };
  }
}
