import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";

/** Questions where another player may buzz after a wrong answer. */
export function isBuzzerQuestionType(type: PackageQuestionType | null | undefined): boolean {
  return (
    type === PackageQuestionType.SIMPLE ||
    type === PackageQuestionType.CHOICE ||
    type === PackageQuestionType.HIDDEN
  );
}

/**
 * Utilities for special-question related logic shared across validators and services
 */
export class SpecialRegularQuestionUtils {
  public static readonly singleAnswererQuestionTypes: ReadonlySet<PackageQuestionType> = new Set([
    PackageQuestionType.NO_RISK,
    PackageQuestionType.SECRET,
    PackageQuestionType.STAKE
  ]);

  public static isSingleAnswererQuestion(game: Game): boolean {
    const currentType = game.gameState.currentQuestion?.type;
    if (currentType == null) return false;
    return SpecialRegularQuestionUtils.singleAnswererQuestionTypes.has(currentType);
  }

  /**
   * Determines if current situation should be treated as a give-up:
   * a special question during ANSWERING phase.
   */
  public static isGiveUpScenario(game: Game): boolean {
    if (!game.gameState.currentQuestion) return false;
    const isAnswering = game.gameState.questionState === QuestionState.ANSWERING;

    return isAnswering && SpecialRegularQuestionUtils.isSingleAnswererQuestion(game);
  }
}
