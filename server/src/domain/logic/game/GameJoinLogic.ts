import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameJoinResult } from "domain/types/socket/game/GameJoinResult";

/**
 * Validation input for game join
 */
export interface GameJoinValidationInput {
  game: Game;
  userId: number;
  role: PlayerRole;
  existingPlayer: Player | null;
}

/**
 * Result of game join mutation
 */
export interface GameJoinMutationResult {
  player: Player;
  wasReconnecting: boolean;
}

interface GameJoinResultInput {
  game: Game;
  player: Player;
}

/**
 * Pure business logic for player joining a game.
 *
 * Handles validation for:
 * - Game state (not finished)
 * - Player restrictions (banned, restricted)
 * - Final round restrictions
 * - Role availability (slots, showman)
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class GameJoinLogic {
  /**
   * Validates all preconditions for joining a game.
   *
   * @throws ClientError if validation fails
   */
  public static validate(input: GameJoinValidationInput): void {
    const { game, role, existingPlayer } = input;

    // Check existing player restrictions FIRST before checking role availability
    if (existingPlayer) {
      // Banned players cannot join at all
      if (existingPlayer.isBanned) {
        throw new ClientError(ClientResponse.YOU_ARE_BANNED);
      }

      // Restricted players can only join as spectators
      if (existingPlayer.isRestricted && role !== PlayerRole.SPECTATOR) {
        throw new ClientError(ClientResponse.YOU_ARE_RESTRICTED);
      }
    }

    // Prevent joining as PLAYER during final round unless reconnecting as existing player.
    // This ensures final round scoring integrity - only players who participated
    // in theme elimination and bidding phases can answer the final question.
    const isFinalRound =
      game.gameState.currentRound?.type === PackageRoundType.FINAL;
    const wasNotPreviouslyPlayer =
      !existingPlayer || existingPlayer.role !== PlayerRole.PLAYER;
    if (isFinalRound && role === PlayerRole.PLAYER && wasNotPreviouslyPlayer) {
      throw new ClientError(ClientResponse.CANNOT_JOIN_FINAL_ROUND_AS_PLAYER);
    }

    // Now check role availability after restriction checks
    if (role === PlayerRole.PLAYER && !game.checkFreeSlot()) {
      throw new ClientError(ClientResponse.GAME_IS_FULL);
    }

    // Check if showman slot is taken
    const showman = game.players.find(
      (p) =>
        p.role === PlayerRole.SHOWMAN &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    const showmanAndTaken = role === PlayerRole.SHOWMAN && !!showman;
    if (showmanAndTaken && existingPlayer?.meta.id !== showman.meta.id) {
      throw new ClientError(ClientResponse.SHOWMAN_IS_TAKEN);
    }
  }

  /**
   * Check if player is reconnecting (vs new join).
   */
  public static isReconnecting(existingPlayer: Player | null): boolean {
    return existingPlayer !== null;
  }

  /**
   * Check if player statistics should be initialized.
   * True for new players with PLAYER role.
   */
  public static shouldInitializeStats(
    existingPlayer: Player | null,
    role: PlayerRole
  ): boolean {
    return !existingPlayer && role === PlayerRole.PLAYER;
  }

  /**
   * Check if player statistics leftAt should be cleared.
   * True for reconnecting players.
   */
  public static shouldClearLeftAt(
    existingPlayer: Player | null,
    role: PlayerRole
  ): boolean {
    return existingPlayer !== null && role === PlayerRole.PLAYER;
  }

  /**
   * Builds the result object.
   */
  public static buildResult(input: GameJoinResultInput): GameJoinResult {
    const { game, player } = input;
    return { game, player };
  }
}
