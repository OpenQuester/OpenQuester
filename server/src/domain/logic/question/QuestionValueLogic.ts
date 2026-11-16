import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { getRealPrice } from "domain/logic/question/questionPrices";
import { type Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/** What the current question is worth for the player answering it. */
export class QuestionValueLogic {
  /**
   * The winning bid for a stake question, the price times its multiplier for
   * a no-risk question, otherwise the actual base price. Automatic and manual
   * rulings both use this, so they score the same answer the same way.
   */
  public static effectiveValue(game: Game): number {
    if (game.gameState.secretQuestionData) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const question = game.gameState.currentQuestion;

    if (!question) {
      return 0;
    }

    const highestBid = game.gameState.stakeQuestionData?.highestBid;
    if (question.type === PackageQuestionType.STAKE && highestBid != null) {
      return highestBid;
    }

    const price = getRealPrice(question) ?? 0;
    if (question.type === PackageQuestionType.NO_RISK) {
      return Math.round(price * (question.priceMultiplier ?? 1));
    }

    return price;
  }
}
