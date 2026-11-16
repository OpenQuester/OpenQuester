import { describe, expect, it } from "@jest/globals";
import { getRealPrice, getVisiblePrice } from "domain/logic/question/questionPrices";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import {
  customSecretPrices,
  resolveSecretFallbackPrice
} from "domain/logic/question/secretQuestionPrices";
import { ChoosingToShowingFallbackHandler } from "domain/state-machine/handlers/special-question/ChoosingToShowingFallbackHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { TransitionTrigger } from "domain/state-machine/types";

describe("question prices", () => {
  it.each([undefined, null, 0, 500])(
    "keeps nominal 100 and actual %s on DTOs and entities",
    (realPrice) => {
      const question = { price: 100, realPrice };
      const entity = Object.assign(new PackageQuestion(), question);
      expect(getVisiblePrice(question)).toBe(100);
      expect(entity.getVisiblePrice()).toBe(100);
      expect(getRealPrice(question)).toBe(realPrice ?? 100);
      expect(entity.getRealPrice()).toBe(realPrice ?? 100);
    }
  );

  it("discloses a secret's actual price only when explicitly requested", () => {
    const question = {
      ...buildGame("PRIC", null).gameState.currentQuestion!,
      type: PackageQuestionType.SECRET,
      realPrice: 0
    };
    expect(GameQuestionMapper.mapToSimpleQuestion(question)).not.toHaveProperty("realPrice");
    expect(GameQuestionMapper.mapToSimpleQuestion(question, true)).toMatchObject({
      price: question.price,
      realPrice: 0
    });
  });

  it.each([0, 1])(
    "resolves legacy custom price with %s players without changing the package or nominal",
    async (players) => {
      const game = buildGame("FALL", null);
      const question = {
        ...game.gameState.currentQuestion!,
        type: PackageQuestionType.SECRET,
        subType: PackageQuestionSubType.CUSTOM_PRICE,
        price: 100,
        allowedPrices: [400, 0, 200]
      };
      const source = structuredClone(question);
      game.setQuestionState(QuestionState.CHOOSING);
      game.gameState.currentQuestion = null;
      game.removePlayer(3);
      if (!players) game.removePlayer(2);
      const ctx = {
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: 1, isSystem: false },
        payload: {
          questionId: question.id!,
          questionData: {
            question,
            theme: { id: 1, name: "Theme", order: 0, questions: [question] }
          }
        }
      };
      const handler = new ChoosingToShowingFallbackHandler();
      expect(handler.canTransition(ctx)).toBe(true);
      await handler.execute(ctx);
      expect(game.gameState.currentQuestion).toMatchObject({ price: 100, realPrice: 0 });
      expect(game.gameState.questionState).toBe(
        players ? QuestionState.ANSWERING : QuestionState.SHOWING
      );
      expect(question).toEqual(source);
    }
  );

  it.each(
    [[], [-1, 100], [0.5, 100], [NaN, 100], [1000001]].map((allowedPrices) => ({ allowedPrices }))
  )("rejects unresolved or invalid offered prices %s", ({ allowedPrices }) => {
    const question = {
      ...buildGame("BADP", null).gameState.currentQuestion!,
      type: PackageQuestionType.SECRET,
      subType: PackageQuestionSubType.CUSTOM_PRICE,
      allowedPrices
    };
    expect(() => customSecretPrices(question)).toThrow();
    expect(() => resolveSecretFallbackPrice(question)).toThrow();
  });
});
