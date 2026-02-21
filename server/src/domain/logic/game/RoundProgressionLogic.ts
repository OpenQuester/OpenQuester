import { Game } from "domain/entities/game/Game";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

/**
 * Result of round progression
 */
interface RoundProgressionResult {
  game: Game;
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
  questionData: PackageQuestionDTO | null;
}

/**
 * Input for `buildResult`.
 */
export interface RoundProgressionResultInput {
  game: Game;
  isGameFinished: boolean;
  nextGameState: GameStateDTO | null;
  questionData: PackageQuestionDTO | null;
}

/**
 * Pure business logic for round progression.
 *
 * Note: The actual round progression logic is handled by RoundHandler.
 * This Logic class is for pre/post processing and result building.
 *
 * Pattern: Static utility class (no dependencies, pure functions)
 */
export class RoundProgressionLogic {
  /**
   * Get current question data before round progression.
   * Used for statistics/logging purposes.
   * @param _game Game entity (unused, kept for interface consistency)
   * @param questionData Pre-fetched question data from PackageStore
   */
  public static getCurrentQuestionData(
    _game: Game,
    questionData: PackageQuestionDTO | null
  ): PackageQuestionDTO | null {
    return questionData;
  }

  /**
   * Builds the result object.
   */
  public static buildResult(
    input: RoundProgressionResultInput
  ): RoundProgressionResult {
    const { game, isGameFinished, nextGameState, questionData } = input;
    return {
      game,
      isGameFinished,
      nextGameState,
      questionData,
    };
  }
}
