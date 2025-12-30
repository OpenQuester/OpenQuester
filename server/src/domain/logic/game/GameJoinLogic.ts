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
  targetSlot: number | null;
  password?: string;
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
    const { game, role, existingPlayer, targetSlot, password, userId } = input;

    // Check password for private games (skip if player is reconnecting or if user is game's creator)
    if (game.isPrivate && !existingPlayer) {
      const gamePassword = game.gameState.password;
      if (
        gamePassword &&
        gamePassword !== password &&
        userId !== game.createdBy
      ) {
        throw new ClientError(ClientResponse.GAME_JOIN_PASSWORD_INVALID);
      }
    }

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

    // Validate slot for player role
    if (role === PlayerRole.PLAYER) {
      this.validateSlotAvailability(game, targetSlot);
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

  /**
   * Validates slot availability for player join.
   * If targetSlot is provided, validates that specific slot.
   * Otherwise, validates that any slot is available.
   *
   * @throws ClientError if slot is not available
   */
  private static validateSlotAvailability(
    game: Game,
    targetSlot: number | null
  ): void {
    // Get occupied slots
    const occupiedSlots = new Set(
      game.players
        .filter(
          (p) =>
            p.role === PlayerRole.PLAYER &&
            p.gameSlot !== null &&
            p.gameStatus === PlayerGameStatus.IN_GAME
        )
        .map((p) => p.gameSlot)
    );

    if (targetSlot !== null) {
      // Specific slot requested - validate it
      if (targetSlot < 0 || targetSlot >= game.maxPlayers) {
        throw new ClientError(ClientResponse.INVALID_SLOT_NUMBER);
      }

      if (occupiedSlots.has(targetSlot)) {
        throw new ClientError(ClientResponse.SLOT_ALREADY_OCCUPIED);
      }
    } else {
      // No specific slot - just check if any slot is available
      if (occupiedSlots.size >= game.maxPlayers) {
        throw new ClientError(ClientResponse.GAME_IS_FULL);
      }
    }
  }
}
