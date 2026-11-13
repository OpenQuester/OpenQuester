import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { AnswerType } from "domain/enums/package/AnswerType";
import { projectAnswerReveal } from "domain/mappers/projectAnswerReveal";
import { describe, expect, it } from "@jest/globals";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";
import { answerWindowDuration } from "domain/logic/question/answerWindowDuration";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import {
  PackageQuestionSubType,
  type PackageQuestionDTO
} from "domain/types/dto/package/PackageQuestionDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { TransitionTrigger } from "domain/state-machine/types";
import { ShowingToAnsweringHandler } from "domain/state-machine/handlers/regular-round/ShowingToAnsweringHandler";
import { DirectMediaToAnsweringHandler } from "domain/state-machine/handlers/special-question/DirectMediaToAnsweringHandler";
import { FinalMediaToAnsweringHandler } from "domain/state-machine/handlers/final-round/FinalMediaToAnsweringHandler";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { uploadPackageScheme } from "presentation/schemes/package/packageSchemes";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { validatePackageContentLimits } from "domain/validators/validatePackageContentLimits";

const question = (): PackageQuestionDTO => ({
  type: PackageQuestionType.SIMPLE,
  subType: PackageQuestionSubType.SIMPLE,
  order: 0,
  price: 100,
  isHidden: false,
  text: "Prompt",
  textOrder: 0,
  textDurationMs: 3000,
  answerDelay: 999999,
  answerDurationMs: 15000,
  showAnswerDuration: 5000,
  answerText: "Paris",
  textItems: [
    { order: 1, text: "Private spoken prompt", placement: "replic", durationMs: 2000 },
    { order: 2, text: "", placement: "screen", durationMs: 1000 }
  ],
  answerTextItems: [
    { order: 0, text: "Explanation before", durationMs: 1000 },
    { order: 2, text: "Explanation after", durationMs: 2000 }
  ],
  answerFiles: [
    { order: 1, displayTime: 4000, file: { md5: "answer", type: PackageFileType.IMAGE } }
  ],
  showmanComments: "Private instruction",
  answerExplanation: "After-answer explanation"
});

describe("authored question content and answer windows", () => {
  it("retains ordered text/blank/private steps while exposing no private speech or future answer", () => {
    const q = question();
    q.textWaitForFinish = false;
    q.textItems![0].waitForFinish = false;
    const safe = GameQuestionMapper.mapToSimpleQuestion(q);
    const fullPlan = QuestionContentPlanLogic.build(q);
    expect(QuestionContentPlanLogic.build(safe)).toEqual(fullPlan);
    expect(JSON.stringify(safe)).not.toMatch(
      /Private spoken|Private instruction|Explanation|After-answer|Paris/
    );
    expect(safe.textItems?.[0]).toEqual({
      order: 1,
      text: "",
      placement: "replic",
      waitForFinish: false,
      durationMs: 2000
    });
    expect(fullPlan?.steps.map((step) => step.durationMs)).toEqual([3000, 2000, 1000]);
    expect(ShowAnswerLogic.buildAnswerPlan(q)?.steps.map((step) => step.items[0].order)).toEqual([
      0, 1, 2
    ]);
    expect(ShowAnswerLogic.calculateShowAnswerDuration(q)).toBe(12000);
    const reveal = {
      answerText: "Paris",
      answerFiles: null,
      nextTurnPlayerId: null,
      answerTextItems: [{ order: 0, text: "Private reveal speech", placement: "replic" as const }]
    };
    expect(projectAnswerReveal(reveal)?.answerTextItems?.[0].text).toBe("");
    expect(projectAnswerReveal(reveal, true)?.answerTextItems?.[0].text).toBe(
      "Private reveal speech"
    );
    expect(ShowAnswerLogic.revealDetails(q)).toMatchObject({
      answerExplanation: "After-answer explanation",
      answerTextItems: q.answerTextItems
    });
  });

  it("applies the override after content for any answerer mode, preserving room post-buzz time", async () => {
    const game = buildGame("CONTENT", null);
    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(question());
    QuestionContentPlanLogic.applyToGame(game);
    expect(QuestionContentPlanLogic.questionTimerDuration(game)).toBe(21000);
    game.gameState.allPlay = {} as NonNullable<typeof game.gameState.allPlay>;
    expect(QuestionContentPlanLogic.questionTimerDuration(game)).toBe(21000);
    game.gameState.allPlay = null;
    const player = game.getPlayer(2, { fetchDisconnected: false })!;
    for (const type of [PackageQuestionType.SIMPLE, PackageQuestionType.NO_RISK]) {
      game.gameState.currentQuestion.type = type;
      game.setQuestionState(QuestionState.SHOWING);
      const result = await new ShowingToAnsweringHandler().execute({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: 2, isSystem: false }
      });
      expect(result.timer?.durationMs).toBe(game.settings.timers.answerSubmitMs);
      expect(() => AnswerSubmittedLogic.validate(game, player)).not.toThrow();
    }
    for (const value of [null, undefined, 0, -1, Infinity, 1.5, 2147483648])
      expect(answerWindowDuration({ answerDurationMs: value }, 20500)).toBe(20500);
    expect(answerWindowDuration({ answerDurationMs: 15000 }, 20500)).toBe(15000);
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(question()),
      textOrder: null,
      textItems: null,
      textDurationMs: 3000
    };
    game.settings = { ...game.settings, falseStart: false };
    QuestionContentPlanLogic.applyToGame(game);
    expect(game.gameState.questionContentPlan?.totalMs).toBe(3000);
    expect(QuestionContentPlanLogic.questionTimerDuration(game)).toBe(18000);
  });

  it("starts direct content only after readiness and resumes a remaining timer instead of granting a new window", async () => {
    const game = buildGame("DIRECT", null);
    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(question());
    game.gameState.answeringPlayer = 2;
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    const handler = new DirectMediaToAnsweringHandler();
    const ctx = {
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: 2, isSystem: false }
    };
    game.players[1].mediaDownloaded = false;
    expect(handler.canTransition(ctx)).toBe(false);
    game.players[1].mediaDownloaded = true;
    expect(handler.canTransition(ctx)).toBe(true);
    const result = await handler.execute(ctx);
    expect(game.gameState.questionState).toBe(QuestionState.ANSWERING);
    expect(game.gameState.answeringPlayer).toBe(2);
    expect(result.timer?.durationMs).toBe(21000);
    const timer = GameStateTimer.fromDTO({ ...result.timer!, elapsedMs: 9000 });
    expect(timer.value()?.elapsedMs).toBe(9000);
    expect(timer.value()?.durationMs).toBe(21000);
  });

  it("rejects direct submissions before readiness, the timer lead and presentation in every format", () => {
    const game = buildGame("DIRECT-SUBMIT", null);
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(question()),
      type: PackageQuestionType.SECRET
    };
    game.gameState.answeringPlayer = 2;
    game.settings = { ...game.settings, falseStart: false };
    QuestionContentPlanLogic.applyToGame(game);
    const player = game.getPlayer(2, { fetchDisconnected: false })!;
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    expect(() => AnswerSubmittedLogic.validate(game, player)).toThrow();
    game.setQuestionState(QuestionState.ANSWERING);
    game.gameState.timer = {
      durationMs: 21000,
      elapsedMs: 0,
      resumedAt: null,
      startedAt: new Date(Date.now() + 10000)
    };
    expect(() => AnswerSubmittedLogic.validate(game, player)).toThrow();
    for (const answerType of [AnswerType.TEXT, AnswerType.NUMBER, AnswerType.POINT]) {
      game.gameState.currentQuestion.answerType = answerType;
      game.gameState.timer.startedAt = new Date();
      expect(() => AnswerSubmittedLogic.validate(game, player)).toThrow();
      game.gameState.timer.startedAt = new Date(Date.now() - 6000);
      expect(() => AnswerSubmittedLogic.validate(game, player)).not.toThrow();
    }
  });

  it("uses the final window only after media preparation and presentation", async () => {
    const game = buildGame("FINAL", null);
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
    game.gameState.finalRoundData = {
      phase: FinalRoundPhase.ANSWERING,
      bids: { 2: 100, 3: 100 },
      answers: [],
      turnOrder: [2, 3],
      eliminatedThemes: [],
      questionData: {
        themeId: 1,
        themeName: "T",
        question: GameQuestionMapper.mapToSimpleQuestion(question())
      }
    };
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    const result = await new FinalMediaToAnsweringHandler().execute({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true }
    });
    expect(result.timer?.durationMs).toBe(21000);
  });

  it("validates collisions and counts answer/private/blank steps without weakening old defaults", () => {
    const q = question();
    const content = {
      title: "P",
      ageRestriction: "NONE",
      tags: [],
      rounds: [
        {
          name: "R",
          type: PackageRoundType.SIMPLE,
          order: 0,
          themes: [{ name: "T", order: 0, questions: [q] }]
        }
      ]
    };
    expect(uploadPackageScheme().validate({ content }).error).toBeUndefined();
    q.answerTextItems![1].order = 1;
    expect(uploadPackageScheme().validate({ content }).error).toBeDefined();
    q.answerTextItems = Array.from({ length: 31 }, (_, order) => ({
      order,
      text: "",
      placement: "replic" as const,
      durationMs: 1000
    }));
    expect(() => validatePackageContentLimits(content)).toThrow();
    const entity = new PackageQuestion();
    entity.import({ ...question(), theme: null! });
    expect(entity.answer_duration_ms).toBe(15000);
    expect(entity.answer_text_items).toEqual(question().answerTextItems);
    expect(entity.showman_comments).toBe("Private instruction");
  });
});
