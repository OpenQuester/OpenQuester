import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";

export interface RoleChangeMutation {
  originalRole: PlayerRole;
  newSlot: number | null;
  wasPlayer: boolean;
}

export interface RoleChangeResult {
  game: Game;
  targetPlayer: PlayerDTO;
  players: PlayerDTO[];
}

interface PlayerRoleChangeResultInput {
  game: Game;
  targetPlayer: Player;
}

/**
 * Logic class for handling player role changes.
 * Manages role transitions and slot assignments.
 */
export class PlayerRoleChangeLogic {
  /**
   * Get first free slot index for a player role.
   */
  public static getFirstFreeSlot(game: Game): number {
    const occupiedSlots = new Set(
      game.players
        .filter((p) => p.role === PlayerRole.PLAYER && p.gameSlot !== null)
        .map((p) => p.gameSlot)
    );

    for (let i = 0; i < game.maxPlayers; i++) {
      if (!occupiedSlots.has(i)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Process role change mutation on player and game state.
   */
  public static processRoleChange(
    game: Game,
    targetPlayer: Player,
    newRole: PlayerRole
  ): RoleChangeMutation {
    const originalRole = targetPlayer.role;
    targetPlayer.role = newRole;

    let newSlot: number | null = null;

    if (newRole === PlayerRole.PLAYER) {
      const firstFreeSlot = this.getFirstFreeSlot(game);
      if (firstFreeSlot === -1) {
        throw new ClientError(ClientResponse.GAME_IS_FULL);
      }
      targetPlayer.gameSlot = firstFreeSlot;
      newSlot = firstFreeSlot;
    } else if (newRole === PlayerRole.SPECTATOR) {
      targetPlayer.gameSlot = null;
    }

    return {
      originalRole,
      newSlot,
      wasPlayer: originalRole === PlayerRole.PLAYER,
    };
  }

  /**
   * Build result for role change operation.
   */
  public static buildResult(
    input: PlayerRoleChangeResultInput
  ): RoleChangeResult {
    const { game, targetPlayer } = input;

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      players: game.players.map((p) => p.toDTO()),
    };
  }
}
