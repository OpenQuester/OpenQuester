import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";

/**
 * Result of player slot change
 */
export interface PlayerSlotChangeResult {
  game: Game;
  playerId: number;
  newSlot: number;
  updatedPlayers: PlayerDTO[];
}

/**
 * Input for `buildResult`.
 */
export interface PlayerSlotChangeResultInput {
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
   * Builds the result object.
   */
  public static buildResult(
    input: PlayerSlotChangeResultInput
  ): PlayerSlotChangeResult {
    const { game, player, newSlot } = input;
    return {
      game,
      playerId: player.meta.id,
      newSlot,
      updatedPlayers: game.players.map((p) => p.toDTO()),
    };
  }
}
