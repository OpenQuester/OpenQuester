import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import {
  PlayerRestrictionBroadcastData,
  PlayerRoleChangeBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";

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
interface PlayerRestrictionMutationResult {
  originalRole: PlayerRole;
  wasPlayer: boolean;
  shouldBan: boolean;
  shouldRestrictToSpectator: boolean;
  newRole?: PlayerRole;
}

/**
 * Data from player restriction update
 */
export interface PlayerRestrictionData {
  game: Game;
  targetPlayer: PlayerDTO;
  wasRemoved: boolean;
  newRole?: PlayerRole;
  gameStateCleanupBroadcasts?: BroadcastEvent[];
}

/**
 * Result of player restriction update with broadcasts
 */
export interface PlayerRestrictionResult {
  data: PlayerRestrictionData;
  broadcasts: SocketEventBroadcast[];
}

interface PlayerBanResultInput {
  game: Game;
  targetPlayer: Player;
  restrictions: RestrictionUpdateInput;
}

interface PlayerRestrictionResultInput {
  game: Game;
  targetPlayer: Player;
  newRole: PlayerRole;
  restrictions: RestrictionUpdateInput;
  gameStateCleanupBroadcasts: BroadcastEvent[];
}

interface PlayerSimpleResultInput {
  game: Game;
  targetPlayer: Player;
  restrictions: RestrictionUpdateInput;
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
   * Build base broadcasts for restriction update
   */
  private static buildBaseBroadcasts(
    game: Game,
    playerId: number,
    restrictions: RestrictionUpdateInput
  ): SocketEventBroadcast[] {
    const broadcastData: PlayerRestrictionBroadcastData = {
      playerId,
      muted: restrictions.muted,
      restricted: restrictions.restricted,
      banned: restrictions.banned,
    };

    return [
      {
        event: SocketIOGameEvents.PLAYER_RESTRICTED,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<PlayerRestrictionBroadcastData>,
    ];
  }

  /**
   * Builds the result for ban scenario (player removed from game).
   */
  public static buildBanResult(
    input: PlayerBanResultInput
  ): PlayerRestrictionResult {
    const { game, targetPlayer, restrictions } = input;
    const playerId = targetPlayer.meta.id;

    const broadcasts = this.buildBaseBroadcasts(game, playerId, restrictions);

    // Add LEAVE broadcast for banned player
    broadcasts.push({
      event: SocketIOGameEvents.LEAVE,
      data: { user: playerId } satisfies GameLeaveEventPayload,
      target: SocketBroadcastTarget.GAME,
      gameId: game.id,
    } satisfies SocketEventBroadcast<GameLeaveEventPayload>);

    return {
      data: {
        game,
        targetPlayer: targetPlayer.toDTO(),
        wasRemoved: true,
      },
      broadcasts,
    };
  }

  /**
   * Builds the result for restriction to spectator scenario.
   */
  public static buildRestrictResult(
    input: PlayerRestrictionResultInput
  ): PlayerRestrictionResult {
    const {
      game,
      targetPlayer,
      newRole,
      restrictions,
      gameStateCleanupBroadcasts,
    } = input;
    const playerId = targetPlayer.meta.id;

    const broadcasts = this.buildBaseBroadcasts(game, playerId, restrictions);

    // Add role change broadcast
    const roleChangeBroadcastData: PlayerRoleChangeBroadcastData = {
      playerId,
      newRole,
      players: game.players.map((p) => p.toDTO()),
    };

    broadcasts.push({
      event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
      data: roleChangeBroadcastData,
      target: SocketBroadcastTarget.GAME,
      gameId: game.id,
    } satisfies SocketEventBroadcast<PlayerRoleChangeBroadcastData>);

    // Add game state cleanup broadcasts
    for (const broadcast of gameStateCleanupBroadcasts) {
      broadcasts.push({
        event: broadcast.event,
        data: broadcast.data,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
        useRoleBasedBroadcast: broadcast.roleFilter,
      });
    }

    return {
      data: {
        game,
        targetPlayer: targetPlayer.toDTO(),
        wasRemoved: false,
        newRole,
        gameStateCleanupBroadcasts,
      },
      broadcasts,
    };
  }

  /**
   * Builds the result for simple restriction update (no role change).
   */
  public static buildSimpleResult(
    input: PlayerSimpleResultInput
  ): PlayerRestrictionResult {
    const { game, targetPlayer, restrictions } = input;
    const playerId = targetPlayer.meta.id;

    const broadcasts = this.buildBaseBroadcasts(game, playerId, restrictions);

    return {
      data: {
        game,
        targetPlayer: targetPlayer.toDTO(),
        wasRemoved: false,
      },
      broadcasts,
    };
  }
}
