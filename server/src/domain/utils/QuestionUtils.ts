import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

/**
 * Utilities for special-question related logic shared across validators and services
 */
export class SpecialQuestionUtils {
  public static readonly specialQuestionTypes: ReadonlySet<PackageQuestionType> =
    new Set([
      PackageQuestionType.NO_RISK,
      PackageQuestionType.SECRET,
      PackageQuestionType.STAKE,
    ]);

  public static isSpecialQuestion(game: Game): boolean {
    const currentType = game.gameState.currentQuestion?.type;
    if (currentType == null) return false;
    return SpecialQuestionUtils.specialQuestionTypes.has(currentType);
  }

  /**
   * Determines if current situation should be treated as a give-up:
   * a special question during ANSWERING phase.
   */
  public static isGiveUpScenario(game: Game): boolean {
    if (!game.gameState.currentQuestion) return false;
    const isAnswering =
      game.gameState.questionState === QuestionState.ANSWERING;

    return isAnswering && SpecialQuestionUtils.isSpecialQuestion(game);
  }

  public static calculateGiveUpPenalty(game: Game): number {
    const price = game.gameState.currentQuestion?.price ?? 1;
    return -Math.max(1, price);
  }
}
