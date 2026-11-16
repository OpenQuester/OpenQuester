import { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { describe, expect, it } from "@jest/globals";

import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

/** Players 2 (score 200) and 3 (score 300) */
function game(): Game {
  const g = buildGame("ALLP", null);
  g.gameState.skippedPlayers = null;
  return g;
}

function question(
  type: PackageQuestionType,
  extra: Partial<PackageQuestionDTO> = {}
): PackageQuestionDTO {
  return {
    id: 7,
    type,
    subType: PackageQuestionSubType.FOR_EVERYONE,
    order: 0,
    price: 100,
    text: "Q",
    answerText: "A",
    answerDelay: 0,
    showAnswerDuration: 5000,
    isHidden: false,
    ...extra
  } as PackageQuestionDTO;
}

describe("AllPlayLogic", () => {
  it("recognises all supported for-everyone mechanics", () => {
    expect(AllPlayLogic.modeOf(question(PackageQuestionType.STAKE))).toBe(AllPlayMode.STAKE);
    expect(AllPlayLogic.modeOf(question(PackageQuestionType.NO_RISK))).toBe(AllPlayMode.NO_RISK);
    expect(
      AllPlayLogic.modeOf(
        question(PackageQuestionType.STAKE, { subType: PackageQuestionSubType.SIMPLE })
      )
    ).toBeNull();
    expect(AllPlayLogic.modeOf(question(PackageQuestionType.SIMPLE))).toBe(AllPlayMode.SIMPLE);
    expect(AllPlayLogic.modeOf(question(PackageQuestionType.CHOICE))).toBe(AllPlayMode.SIMPLE);
  });

  it("caps a stake at the player's score, at least the price, and the package limit", () => {
    const g = game();
    const data = AllPlayLogic.start(
      g,
      question(PackageQuestionType.STAKE, { maxPrice: 250 }),
      1,
      AllPlayMode.STAKE
    );

    expect(AllPlayLogic.maxStakeFor(g, data, 2)).toBe(200);
    expect(AllPlayLogic.maxStakeFor(g, data, 3)).toBe(250);
  });

  it("fills missing stakes with the price when time runs out", () => {
    const g = game();
    AllPlayLogic.start(g, question(PackageQuestionType.STAKE), 1, AllPlayMode.STAKE);
    g.gameState.questionState = QuestionState.BIDDING;
    AllPlayLogic.submitStake(g, 3, 300);

    AllPlayLogic.fillMissingStakes(g);

    expect(g.gameState.allPlay!.entries.map((e) => e.stake)).toEqual([100, 300]);
  });

  it("rules an empty answer wrong when the review starts", () => {
    const g = game();
    AllPlayLogic.start(g, question(PackageQuestionType.STAKE), 1, AllPlayMode.STAKE);
    g.gameState.allPlay!.entries[0].stake = 100;
    g.gameState.allPlay!.entries[1].stake = 50;
    g.gameState.questionState = QuestionState.SHOWING;
    AllPlayLogic.submitAnswer(g, 3, "answer");

    const auto = AllPlayLogic.startReview(g);

    expect(auto.map((e) => e.playerId)).toEqual([2]);
    expect(g.getPlayer(2, { fetchDisconnected: true })!.score).toBe(100);
    expect(AllPlayLogic.allReviewed(g)).toBe(false);
  });

  it("scores no-risk by the multiplier and never takes points", () => {
    const g = game();
    AllPlayLogic.start(
      g,
      question(PackageQuestionType.NO_RISK, { priceMultiplier: 1.5 }),
      1,
      AllPlayMode.NO_RISK
    );
    g.gameState.questionState = QuestionState.REVIEWING;

    expect(AllPlayLogic.review(g, 2, true).scoreChange).toBe(150);
    expect(AllPlayLogic.review(g, 3, false).scoreChange).toBe(0);
    expect(AllPlayLogic.allReviewed(g)).toBe(true);
  });

  it("hides answers and stakes from players until the review", () => {
    const g = game();
    const data = AllPlayLogic.start(g, question(PackageQuestionType.STAKE), 1, AllPlayMode.STAKE);
    data.entries[0].stake = 120;
    data.entries[0].answer = "mine";

    const hidden = AllPlayLogic.hideFromPlayers(data, QuestionState.SHOWING);
    expect(hidden.entries[0]).toMatchObject({ stake: 0, answer: "" });
    expect(AllPlayLogic.hideFromPlayers(data, QuestionState.REVIEWING)).toBe(data);
  });
});

describe("normal for everyone scoring", () => {
  it.each([WrongAnswerPenalty.SUBTRACT, WrongAnswerPenalty.NONE])(
    "snapshots actual price and %s, preserving the first answer and ruling once",
    (penalty) => {
      const g = game();
      g.settings = { ...g.settings, wrongAnswerPenalty: penalty };
      const q = question(PackageQuestionType.SIMPLE, { realPrice: 500 });
      const data = AllPlayLogic.start(g, q, 1, AllPlayMode.SIMPLE);
      g.settings = {
        ...g.settings,
        wrongAnswerPenalty:
          penalty === WrongAnswerPenalty.NONE
            ? WrongAnswerPenalty.SUBTRACT
            : WrongAnswerPenalty.NONE
      };
      q.realPrice = 900;
      g.setQuestionState(QuestionState.SHOWING);
      AllPlayLogic.submitAnswer(g, 2, "first");
      expect(() => AllPlayLogic.submitAnswer(g, 2, "second")).toThrow();
      expect(data.entries[0].answer).toBe("first");
      AllPlayLogic.startReview(g, q);
      AllPlayLogic.startReview(g, q);
      expect(data.entries[1].scoreChange).toBe(penalty === WrongAnswerPenalty.NONE ? 0 : -500);
      expect(g.getPlayer(3, { fetchDisconnected: true })!.score).toBe(
        penalty === WrongAnswerPenalty.NONE ? 300 : -200
      );
      g.setQuestionState(QuestionState.REVIEWING);
      expect(AllPlayLogic.review(g, 2, true).scoreChange).toBe(500);
      expect(() => AllPlayLogic.review(g, 2, true)).toThrow();
    }
  );

  it("preserves actual zero and the score clamp", () => {
    const g = game();
    const data = AllPlayLogic.start(
      g,
      question(PackageQuestionType.SIMPLE, { realPrice: 0 }),
      1,
      AllPlayMode.SIMPLE
    );
    expect(AllPlayLogic.scoreChange(data, data.entries[0], true)).toBe(0);
    expect(AllPlayLogic.scoreChange(data, data.entries[0], false)).toBe(0);
    data.price = 100;
    g.getPlayer(2, { fetchDisconnected: true })!.score = SCORE_ABS_LIMIT - 1;
    g.setQuestionState(QuestionState.REVIEWING);
    AllPlayLogic.review(g, 2, true);
    expect(g.getPlayer(2, { fetchDisconnected: true })!.score).toBe(SCORE_ABS_LIMIT);
  });
});
