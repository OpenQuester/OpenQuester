import { type Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/** What the current question is worth for the player answering it. */
export class QuestionValueLogic {
  /**
   * The winning bid for a stake question, the price times its multiplier for
   * a no-risk question, otherwise the board price. Automatic and manual
   * rulings both use this, so they score the same answer the same way.
   */
  public static effectiveValue(game: Game): number {
    const question = game.gameState.currentQuestion;

    if (!question) {
      return 0;
    }

    const highestBid = game.gameState.stakeQuestionData?.highestBid;
    if (question.type === PackageQuestionType.STAKE && highestBid != null) {
      return highestBid;
    }

    const price = question.price ?? 0;
    if (question.type === PackageQuestionType.NO_RISK) {
      return Math.round(price * (question.priceMultiplier ?? 1));
    }

    return price;
  }
}
