import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * Restriction update input
 */
export interface RestrictionUpdateInput {
  muted: boolean;
  restricted: boolean;
  banned: boolean;
}

/**
 * Result of processing player restrictions
 */
export interface PlayerRestrictionMutationResult {
  originalRole: PlayerRole;
  wasPlayer: boolean;
  shouldBan: boolean;
  shouldRestrictToSpectator: boolean;
  newRole?: PlayerRole;
}

/**
 * Result of player restriction update
 */
export interface PlayerRestrictionResult {
  game: Game;
  targetPlayer: PlayerDTO;
  wasRemoved: boolean;
  newRole?: PlayerRole;
  gameStateCleanupBroadcasts?: BroadcastEvent[];
}

interface PlayerBanResultInput {
  game: Game;
  targetPlayer: Player;
}

interface PlayerRestrictionResultInput {
  game: Game;
  targetPlayer: Player;
  newRole: PlayerRole;
  gameStateCleanupBroadcasts: BroadcastEvent[];
}

interface PlayerSimpleResultInput {
  game: Game;
  targetPlayer: Player;
}

/**
 * Pure business logic for updating player restrictions (mute/restrict/ban).
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class PlayerRestrictionLogic {
  /**
   * Apply restrictions to player and determine required actions.
   */
  public static applyRestrictions(
    player: Player,
    restrictions: RestrictionUpdateInput
  ): PlayerRestrictionMutationResult {
    const originalRole = player.role;
    const wasPlayer = player.role === PlayerRole.PLAYER;

    // Update restriction flags
    player.isMuted = restrictions.muted;
    player.isRestricted = restrictions.restricted;
    player.isBanned = restrictions.banned;

    // Determine if player should be banned (removes from game)
    const shouldBan = restrictions.banned;

    // Determine if player should be restricted to spectator
    const shouldRestrictToSpectator =
      !restrictions.banned &&
      restrictions.restricted &&
      player.role === PlayerRole.PLAYER;

    let newRole: PlayerRole | undefined;

    if (shouldRestrictToSpectator) {
      player.role = PlayerRole.SPECTATOR;
      player.gameSlot = null;
      newRole = PlayerRole.SPECTATOR;
    }

    return {
      originalRole,
      wasPlayer,
      shouldBan,
      shouldRestrictToSpectator,
      newRole,
    };
  }

  /**
   * Check if player was originally a player role (for statistics cleanup).
   */
  public static wasPlayerRole(originalRole: PlayerRole): boolean {
    return originalRole === PlayerRole.PLAYER;
  }

  /**
   * Builds the result for ban scenario (player removed from game).
   */
  public static buildBanResult(
    input: PlayerBanResultInput
  ): PlayerRestrictionResult {
    const { game, targetPlayer } = input;
    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      wasRemoved: true,
    };
  }

  /**
   * Builds the result for restriction to spectator scenario.
   */
  public static buildRestrictResult(
    input: PlayerRestrictionResultInput
  ): PlayerRestrictionResult {
    const { game, targetPlayer, newRole, gameStateCleanupBroadcasts } = input;

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      wasRemoved: false,
      newRole,
      gameStateCleanupBroadcasts,
    };
  }

  /**
   * Builds the result for simple restriction update (no role change).
   */
  public static buildSimpleResult(
    input: PlayerSimpleResultInput
  ): PlayerRestrictionResult {
    const { game, targetPlayer } = input;

    return {
      game,
      targetPlayer: targetPlayer.toDTO(),
      wasRemoved: false,
    };
  }
}
