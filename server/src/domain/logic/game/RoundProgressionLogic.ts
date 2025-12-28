import { Game } from "domain/entities/game/Game";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

/**
 * Result of round progression
 */
export interface RoundProgressionResult {
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
   */
  public static getCurrentQuestionData(game: Game): PackageQuestionDTO | null {
    const currentRound = game.gameState.currentRound;
    const currentQuestion = game.gameState.currentQuestion;

    if (!currentQuestion || !currentRound) {
      return null;
    }

    return (
      GameQuestionMapper.getQuestionAndTheme(
        game.package,
        currentRound.id,
        currentQuestion.id!
      )?.question ?? null
    );
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
