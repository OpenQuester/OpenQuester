import { describe, expect, it } from "@jest/globals";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { AnswerCheckLogic } from "domain/logic/question/AnswerCheckLogic";
import { ChoiceSelectionLogic } from "domain/logic/question/ChoiceSelectionLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { FinalAnswerSubmitLogic } from "domain/logic/final-round/FinalAnswerSubmitLogic";
import { projectFinalRoundData } from "domain/mappers/projectFinalRoundData";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { ShowingToAnsweringHandler } from "domain/state-machine/handlers/regular-round/ShowingToAnsweringHandler";
import { TransitionTrigger } from "domain/state-machine/types";
import { GameMapper } from "domain/mappers/GameMapper";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  type PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const question = (type = PackageQuestionType.SIMPLE): PackageQuestionDTO => ({
  id: 7,
  type,
  subType: PackageQuestionSubType.SIMPLE,
  order: 0,
  price: 100,
  isHidden: false,
  text: null,
  answerType: AnswerType.SELECT,
  answerText: null,
  answerDelay: 0,
  showAnswerDuration: 5000,
  correctChoiceOrder: 2,
  showDelay: 0,
  answers: [0, 1, 2].map((order) => ({
    order,
    sourceLabel: String.fromCharCode(65 + order),
    text: null,
    file: { md5: "same", type: PackageFileType.IMAGE }
  }))
});

describe("select is independent of mechanics", () => {
  it.each(Object.values(PackageQuestionType))(
    "checks an exact option with %s mechanics",
    (type) => {
      const q = question(type);
      expect(AnswerCheckLogic.check(q, "3", 2)).toBe(true);
      expect(AnswerCheckLogic.check(q, "1", 0)).toBe(false);
      const publicQuestion = GameQuestionMapper.mapToSimpleQuestion(q);
      expect(publicQuestion.type).toBe(type);
      expect(publicQuestion).not.toHaveProperty("correctChoiceOrder");
      expect(publicQuestion).not.toHaveProperty("answerText");
    }
  );

  it.each([AllPlayMode.NO_RISK, AllPlayMode.STAKE])(
    "stores independent wrong picks in %s all-play and filters reconnect",
    (mode) => {
      const game = buildGame("SELECT", null);
      const q = question(
        mode === AllPlayMode.STAKE ? PackageQuestionType.STAKE : PackageQuestionType.NO_RISK
      );
      game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(q);
      const data = AllPlayLogic.start(game, q, 1, mode);
      game.gameState.questionState = QuestionState.SHOWING;
      data.entries.forEach((entry) => {
        entry.stake = 100;
      });
      AllPlayLogic.submitAnswer(game, 2, "1", 0);
      expect(() => AllPlayLogic.submitAnswer(game, 2, "3", 2)).toThrow();
      AllPlayLogic.submitAnswer(game, 3, "1", 0);
      const restored = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
      expect(restored.gameState.allPlay!.entries.map((entry) => entry.choiceOrder)).toEqual([0, 0]);
      expect(
        JSON.stringify(AllPlayLogic.hideFromPlayers(data, QuestionState.SHOWING))
      ).not.toContain("choiceOrder");
      AllPlayLogic.startReview(restored, q);
      expect(
        restored.gameState.allPlay!.entries.map((entry) => [entry.isCorrect, entry.scoreChange])
      ).toEqual([
        [false, mode === AllPlayMode.STAKE ? -100 : 0],
        [false, mode === AllPlayMode.STAKE ? -100 : 0]
      ]);
    }
  );

  it.each([PackageQuestionType.STAKE, PackageQuestionType.SECRET, PackageQuestionType.NO_RISK])(
    "waits for timed content and option delay with false start off in direct/all-play %s select",
    (type) => {
      const game = buildGame("SELECT", null);
      game.settings.falseStart = false;
      game.gameState.currentQuestion = {
        ...question(type),
        text: "Read the question first",
        textOrder: 0,
        showDelay: 500
      };
      if (type === PackageQuestionType.NO_RISK) {
        AllPlayLogic.start(game, game.gameState.currentQuestion, 1, AllPlayMode.NO_RISK);
      }
      const contentMs = QuestionContentPlanLogic.applyToGame(game);
      expect(contentMs).toBeGreaterThan(0);
      expect(game.gameState.buzzerOpensAtMs).toBe(contentMs + 500);
      const now = new Date();
      game.gameState.timer = { startedAt: now, resumedAt: now, elapsedMs: 0, durationMs: 30_000 };
      expect(() => ChoiceSelectionLogic.resolve(game, "1", 0)).toThrow();
      game.gameState.timer.elapsedMs = contentMs;
      expect(() => ChoiceSelectionLogic.resolve(game, "1", 0)).toThrow();
      game.gameState.timer.elapsedMs = contentMs + 500;
      expect(ChoiceSelectionLogic.resolve(game, "1", 0)).toBe(0);
    }
  );

  it.each([true, false])(
    "accepts a single no-risk selection immediately after an eligible buzz (falseStart=%s)",
    async (falseStart) => {
      const game = buildGame("SELECT", null);
      game.settings.falseStart = falseStart;
      game.gameState.questionState = QuestionState.SHOWING;
      game.gameState.questionEligiblePlayers = [2];
      game.gameState.currentQuestion = {
        ...question(PackageQuestionType.NO_RISK),
        text: "Read the question first",
        textOrder: 0,
        showDelay: 500
      };
      const contentMs = QuestionContentPlanLogic.applyToGame(game);
      expect(contentMs).toBeGreaterThan(0);
      expect(game.gameState.buzzerOpensAtMs).toBe(falseStart ? contentMs + 500 : 0);
      const showingTimer = {
        startedAt: new Date(Date.now() - contentMs - 500),
        elapsedMs: 0,
        resumedAt: null,
        durationMs: 30_000
      };
      game.gameState.timer = showingTimer;
      const transition = new ShowingToAnsweringHandler();
      const ctx = {
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { isSystem: false, playerId: 2 }
      };
      expect(transition.canTransition(ctx)).toBe(true);
      await transition.execute(ctx);
      expect(game.gameState.answeringPlayer).toBe(2);
      expect(game.gameState.timer).not.toBe(showingTimer);
      expect(game.gameState.timer?.durationMs).toBe(game.settings.timers.answerSubmitMs);
      expect(ChoiceSelectionLogic.resolve(game, "3", 2)).toBe(2);
    }
  );

  it("keeps ordinary early buzzing when false start is off", () => {
    const game = buildGame("SELECT", null);
    game.settings.falseStart = false;
    game.gameState.currentQuestion = { ...question(), text: "Read", textOrder: 0, showDelay: 500 };
    expect(QuestionContentPlanLogic.applyToGame(game)).toBeGreaterThan(0);
    expect(game.gameState.buzzerOpensAtMs).toBe(0);
  });

  it("rejects forged, fractional, nonmember, duplicate orders and missing explicit identity", () => {
    const game = buildGame("SELECT", null);
    game.gameState.currentQuestion = question();
    for (const [text, order] of [
      ["3", 0],
      ["1", 0.5],
      ["1", 99],
      ["1", undefined]
    ] as const) {
      expect(() => ChoiceSelectionLogic.resolve(game, text, order)).toThrow();
    }
    game.gameState.currentQuestion.answers![1].order = 0;
    expect(() => ChoiceSelectionLogic.resolve(game, "1", 0)).toThrow();
  });

  it("keeps final selection and bids private until manual review and locks the first submission", () => {
    const game = buildGame("SELECT", null);
    game.gameState.currentQuestion = null;
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    const data = FinalRoundStateManager.initializeFinalRoundData(game);
    data.phase = FinalRoundPhase.ANSWERING;
    data.bids = { 2: 100, 3: 200 };
    data.questionData = {
      themeId: 1,
      themeName: "T",
      question: GameQuestionMapper.mapToSimpleQuestion(question())
    };
    FinalAnswerSubmitLogic.addAnswer(game, 2, "3", 2);
    expect(() => FinalAnswerSubmitLogic.addAnswer(game, 2, "1", 0)).toThrow();
    const hidden = projectFinalRoundData(data, 3)!;
    expect(hidden.bids).toEqual({ 3: 200 });
    expect(JSON.stringify(hidden.answers)).not.toContain("choiceOrder");
    expect(data.answers[0]).toMatchObject({ choiceOrder: 2, answer: "3" });
    expect(data.answers[0].isCorrect).toBeUndefined();
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
    expect(projectFinalRoundData(data)!.answers[0].choiceOrder).toBe(2);
  });

  it.each([9, 30])(
    "accepts %i select options through the package boundary, rejects duplicate orders",
    (count) => {
      const q = {
        ...question(),
        answers: Array.from({ length: count }, (_, order) => ({
          order,
          text: `O${order}`,
          file: null
        }))
      };
      delete q.id;
      const body = {
        content: {
          title: "Select",
          ageRestriction: "NONE",
          tags: [],
          rounds: [
            {
              name: "R",
              order: 0,
              type: "simple",
              themes: [{ name: "T", order: 0, questions: [q] }]
            }
          ]
        }
      };
      expect(uploadPackageScheme().validate(body).error).toBeUndefined();
      q.answers[1].order = 0;
      expect(uploadPackageScheme().validate(body).error).toBeDefined();
    }
  );
});
