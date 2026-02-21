import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerSlotChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Data of player slot change
 */
export interface PlayerSlotChangeData {
  game: Game;
  playerId: number;
  newSlot: number;
  updatedPlayers: PlayerDTO[];
}

/**
 * Result of player slot change with broadcasts
 */
export interface PlayerSlotChangeResult {
  data: PlayerSlotChangeData;
  broadcasts: SocketEventBroadcast[];
}

/**
 * Input for `buildResult`.
 */
interface PlayerSlotChangeResultInput {
  game: Game;
  player: Player;
  newSlot: number;
}

/**
 * Pure business logic for changing player slot.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class PlayerSlotChangeLogic {
  /**
   * Apply slot change to player.
   */
  public static applySlotChange(player: Player, targetSlot: number): void {
    player.gameSlot = targetSlot;
  }

  /**
   * Builds the result object with broadcasts.
   */
  public static buildResult(
    input: PlayerSlotChangeResultInput
  ): PlayerSlotChangeResult {
    const { game, player, newSlot } = input;
    const playerId = player.meta.id;
    const updatedPlayers = game.players.map((p) => p.toDTO());

    const broadcastData: PlayerSlotChangeBroadcastData = {
      playerId,
      newSlot,
      players: updatedPlayers,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.PLAYER_SLOT_CHANGE,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<PlayerSlotChangeBroadcastData>,
    ];

    return {
      data: { game, playerId, newSlot, updatedPlayers },
      broadcasts,
    };
  }
}
