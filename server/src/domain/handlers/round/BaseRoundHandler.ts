import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";

/**
 * Options for round progression operations
 */
export interface RoundProgressionOptions {
  /**
   * Whether progression is forced (showman skip) or natural (all questions played)
   * @default false - natural progression
   */
  forced?: boolean;
  nextRound: GameStateRoundDTO | null;
}

/**
 * Result interface for round progression operations
 */
export interface RoundProgressionResult {
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
}

/**
 * Abstract base class for handling different round types in the game.
 * Implements the Strategy Pattern for round-specific logic.
 */
export abstract class BaseRoundHandler {
  protected readonly roundType: PackageRoundType;

  protected constructor(roundType: PackageRoundType) {
    this.roundType = roundType;
  }

  /**
   * Handles progression logic when all questions in round are completed
   * @param game - The game instance
   * @param options - Options for round progression behavior
   */
  abstract handleRoundProgression(
    game: Game,
    options?: RoundProgressionOptions
  ): Promise<RoundProgressionResult>;

  /**
   * Validates if the round can progress to next
   */
  abstract validateRoundProgression(game: Game): void;

  /**
   * Gets the round type this handler manages
   */
  public getRoundType(): PackageRoundType {
    return this.roundType;
  }

  /**
   * Helper method to validate game is in valid state for round operations
   */
  protected validateGameState(game: Game): void {
    if (!game) {
      throw new ClientError(ClientResponse.ROUND_GAME_REQUIRED);
    }

    if (!game.gameState) {
      throw new ClientError(ClientResponse.ROUND_GAME_STATE_REQUIRED);
    }
  }
}
