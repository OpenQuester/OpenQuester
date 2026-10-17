import { describe, expect, it } from "@jest/globals";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionValueLogic } from "domain/logic/question/QuestionValueLogic";
import { type StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

describe("QuestionValueLogic.effectiveValue", () => {
  it("is the board price for a simple question", () => {
    const game = buildGame("VAL1", null);
    game.gameState.currentQuestion!.price = 300;

    expect(QuestionValueLogic.effectiveValue(game)).toBe(300);
  });

  it("applies the multiplier of a no-risk question", () => {
    const game = buildGame("VAL2", null);
    Object.assign(game.gameState.currentQuestion!, {
      type: PackageQuestionType.NO_RISK,
      price: 300,
      priceMultiplier: 2
    });

    expect(QuestionValueLogic.effectiveValue(game)).toBe(600);
  });

  it("uses the winning bid of a stake question", () => {
    const game = buildGame("VAL3", null);
    Object.assign(game.gameState.currentQuestion!, { type: PackageQuestionType.STAKE, price: 300 });
    game.gameState.stakeQuestionData = { highestBid: 1200 } as StakeQuestionGameData;

    expect(QuestionValueLogic.effectiveValue(game)).toBe(1200);
  });
});
