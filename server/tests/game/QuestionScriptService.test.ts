import { describe, expect, it } from "@jest/globals";
import { QuestionScriptService } from "application/services/question/QuestionScriptService";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import { DataMutationType } from "domain/enums/DataMutationType";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { projectScriptState } from "domain/mappers/projectScriptState";
import type { ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import type { QuestionScriptStep } from "domain/types/dto/package/QuestionScriptDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import type { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const current = { op: "setAnswerer", mode: "current" } as const;
const everyone = { op: "setAnswerer", mode: "all" } as const;
const number = { op: "setAnswerType", answerType: "number" } as const;
const ask = { op: "askAnswer", mode: "direct", durationMs: null } as const;
const button = { ...ask, mode: "button" } as const;
const range = { min: 100, max: 300, step: 200 };
const price = { op: "setPrice", mode: "select", range } as const;
const accept = { op: "accept" } as const;
const invalidState = ClientResponse.INVALID_QUESTION_STATE;

function scenario(steps: QuestionScriptStep[], final = false) {
  const game = buildGame("SCRIPT", null);
  if (final) {
    game.gameState.currentRound!.type = PackageRoundType.FINAL;
  }
  const source: PackageQuestionDTO = {
    ...game.gameState.currentQuestion!,
    answerText: "42",
    answerNumber: 42,
    script: { version: 1, steps }
  };
  const store = {
    getQuestionWithTheme: async () => ({ question: source }),
    getQuestions: async () => [{ price: 100 }, { price: 300 }, { price: -1 }]
  } as unknown as PackageStore;
  const service = new QuestionScriptService(store);
  const state = game.gameState;
  const context = (
    type: GameActionType,
    id: number,
    payload?: unknown
  ): ActionExecutionContext<unknown> => ({
    game,
    currentPlayer: game.getPlayer(id, { fetchDisconnected: false }),
    timer: null,
    lockToken: "lock",
    userData: null,
    action: {
      id: "script-action",
      type,
      playerId: id,
      gameId: game.id,
      socketId: "script-socket",
      timestamp: new Date(),
      scriptQuestionId: state.scriptProgress?.questionId,
      scriptStep: state.scriptProgress?.programCounter,
      payload
    }
  });
  const expiration = (payload: Record<string, unknown> = {}) =>
    context(GameActionType.TIMER_QUESTION_SHOWING_EXPIRED, -1, {
      timerKey: timerKey(game.id),
      questionState: state.questionState,
      expirationTime: new Date(Date.now() + 60_000),
      ...payload
    });
  return {
    game,
    state,
    source,
    context,
    expiration,
    start: () => service.startPicked(game, source, 1, 2),
    execute: (ctx: ActionExecutionContext<unknown>) => service.execute(ctx),
    send: (type: GameActionType, id: number, payload?: unknown) =>
      service.execute(context(type, id, payload)),
    expire: () => service.execute(expiration()),
    after: (type: GameActionType, id: number, payload?: unknown) =>
      service.afterAction(context(type, id, payload), { success: true, mutations: [] }),
    score: (id: number) => game.getPlayer(id, { fetchDisconnected: true })?.score
  };
}

describe("queued script rules", () => {
  it.each([
    "old step",
    "different question",
    "missing identity",
    "paused",
    "banned",
    "restricted",
    "absent"
  ])("does not accept a direct answer with %s", async (reason) => {
    const s = scenario([current, number, ask]);
    await s.start();
    const ctx = s.context(GameActionType.ANSWER_SUBMITTED, 2, { answerText: "42" });
    switch (reason) {
      case "old step":
        ctx.action.scriptStep = 1;
        break;
      case "different question":
        ctx.action.scriptQuestionId = 99;
        break;
      case "missing identity":
        delete ctx.action.scriptStep;
        break;
      case "paused":
        s.game.pause();
        break;
      case "banned":
        ctx.currentPlayer!.isBanned = true;
        break;
      case "restricted":
        ctx.currentPlayer!.isRestricted = true;
        break;
      case "absent":
        ctx.currentPlayer = null;
        break;
    }
    await expect(s.execute(ctx)).rejects.toThrow(invalidState);
    expect(s.state.scriptProgress).toMatchObject({ waitingFor: "answer", submissions: [] });
    expect(s.score(2)).toBe(200);
  });

  it("routes ordinary actions to their normal handler and rejects commands for a finished step", async () => {
    const s = scenario([current, accept]);
    expect(await s.send(GameActionType.ANSWER_SUBMITTED, 2)).toBeUndefined();
    await s.start();
    expect(await s.send(GameActionType.PAUSE, 1)).toBeUndefined();
    const stale = s.context(GameActionType.ANSWER_SUBMITTED, 2, { answerText: "42" });
    stale.action.scriptStep = 1;
    await expect(s.execute(stale)).rejects.toThrow(invalidState);
    expect(s.score(2)).toBe(300);
  });

  it.each(["replacement", "other phase", "old deadline", "other key", "paused", "removed clock"])(
    "ignores expiration of a %s during price selection",
    async (reason) => {
      const s = scenario([current, price, ask]);
      await s.start();
      const ctx = s.expiration();
      const payload = ctx.action.payload as Record<string, unknown>;
      switch (reason) {
        case "replacement":
          ctx.timer = s.state.timer;
          break;
        case "other phase":
          payload.questionState = QuestionState.BIDDING;
          break;
        case "old deadline":
          payload.expirationTime = new Date(0);
          break;
        case "other key":
          payload.timerKey = timerKey("other");
          break;
        case "paused":
          s.game.pause();
          break;
        case "removed clock":
          s.state.timer = null;
          break;
      }
      expect(await s.execute(ctx)).toEqual({ success: true, mutations: [] });
      expect(s.state.scriptProgress?.waitingFor).toBe("price");
      expect(s.state.currentQuestion?.realPrice).toBeUndefined();
    }
  );

  it.each([99, 200, 301, 100.5, "300", NaN, Infinity])(
    "keeps the price wait after invalid amount %s",
    async (amount) => {
      const s = scenario([current, price, ask]);
      await s.start();
      await expect(
        s.send(GameActionType.SECRET_QUESTION_PRICE_SELECT, 2, { price: amount })
      ).rejects.toThrow(ClientResponse.VALIDATION_ERROR);
      expect(s.state.scriptProgress?.waitingFor).toBe("price");
    }
  );

  it.each(["chooser", "showman", "timeout"])(
    "resolves the price through the %s",
    async (method) => {
      const s = scenario([current, price, number, ask]);
      await s.start();
      const command = GameActionType.SECRET_QUESTION_PRICE_SELECT;
      await expect(s.send(command, 3, { price: 300 })).rejects.toThrow(
        ClientResponse.VALIDATION_ERROR
      );
      if (method === "timeout") {
        await s.expire();
      } else {
        await s.send(command, method === "showman" ? 1 : 2, { price: 300 });
      }
      const resolved = method === "timeout" ? 100 : 300;
      expect(s.state).toMatchObject({
        questionState: QuestionState.ANSWERING,
        currentQuestion: { price: 100, realPrice: resolved },
        answeringPlayer: 2
      });
      await expect(s.send(command, 2, { price: 100 })).rejects.toThrow(
        ClientResponse.VALIDATION_ERROR
      );
      await s.send(GameActionType.ANSWER_SUBMITTED, 2, { answerText: "42" });
      expect(s.score(2)).toBe(200 + resolved);
    }
  );

  it("chooses round extrema for the scripted price without modifying the source cell", async () => {
    const s = scenario([current, { ...price, range: { min: 0, max: 0, step: 0 } }, ask]);
    await s.start();
    expect(s.state.scriptProgress?.priceRange).toEqual(range);
    await s.expire();
    expect(s.state.currentQuestion?.realPrice).toBe(100);
    expect(s.source.realPrice).toBeUndefined();
  });

  it.each(["chooser", "showman", "timeout"])(
    "transfers the script through the %s",
    async (method) => {
      const s = scenario([{ op: "setAnswerer", mode: "byCurrent", select: "any" }, ask]);
      await s.start();
      const transfer = GameActionType.SECRET_QUESTION_TRANSFER;
      await expect(s.send(transfer, 3, { targetPlayerId: 3 })).rejects.toThrow(invalidState);
      for (const targetPlayerId of [1, 99]) {
        await expect(s.send(transfer, 2, { targetPlayerId })).rejects.toThrow(
          ClientResponse.VALIDATION_ERROR
        );
      }
      if (method === "timeout") {
        await s.expire();
      } else {
        await s.send(transfer, method === "showman" ? 1 : 2, { targetPlayerId: 3 });
      }
      expect(s.state).toMatchObject({
        secretQuestionData: null,
        questionState: QuestionState.ANSWERING,
        answeringPlayer: method === "timeout" ? 2 : 3
      });
    }
  );

  it.each(["timeout", "chooser departure"])(
    "skips an empty transfer after %s without assigning the picker",
    async (resolution) => {
      const s = scenario([
        { op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" },
        ask,
        accept
      ]);
      await s.game.addPlayer({ id: 4, username: "four", avatar: null }, PlayerRole.PLAYER, null);
      await s.start();
      expect(s.state.scriptProgress?.waitingFor).toBe("answerer");
      s.game.removePlayer(3);
      s.game.removePlayer(4);
      if (resolution === "timeout") {
        await s.expire();
      } else {
        s.game.removePlayer(2);
        await s.after(GameActionType.LEAVE, 2);
      }
      expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
      expect(s.state.scriptProgress).toBeNull();
      expect(s.score(2)).toBe(200);
    }
  );

  it("automatically transfers to the only other eligible player", async () => {
    const s = scenario([{ op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" }, ask]);
    await s.start();
    expect(s.state).toMatchObject({ secretQuestionData: null, answeringPlayer: 3 });
  });

  it.each(["submit", "timeout"])("opens a scripted group ask after stakes %s", async (method) => {
    const s = scenario([
      { op: "setAnswerer", mode: "stake", select: "allPossible", stakeVisibility: "hidden" },
      number,
      ask
    ]);
    await s.start();
    const stake = GameActionType.EVERYONE_STAKE_SUBMIT;
    await expect(s.send(stake, 2, { amount: 0 })).rejects.toThrow(
      ClientResponse.ALL_PLAY_INVALID_STAKE
    );
    await s.send(stake, 2, { amount: 150 });
    expect(s.state.questionState).toBe(QuestionState.BIDDING);
    await expect(s.send(stake, 2, { amount: 100 })).rejects.toThrow(
      ClientResponse.ALL_PLAY_ALREADY_SUBMITTED
    );
    if (method === "timeout") {
      await s.expire();
    } else {
      await s.send(stake, 3, { amount: 200 });
    }
    const otherStake = method === "timeout" ? 100 : 200;
    expect(s.state.scriptProgress?.stakes).toEqual({ 2: 150, 3: otherStake });
    await s.send(GameActionType.EVERYONE_ANSWER_SUBMIT, 2, { answerText: "42" });
    expect(s.score(2)).toBe(200);
    await s.send(GameActionType.EVERYONE_ANSWER_SUBMIT, 3, { answerText: "7" });
    expect([s.score(2), s.score(3)]).toEqual([350, 300 - otherStake]);
    expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
  });

  it.each(["pass", "timeout"])(
    "advances an auction and resolves the winner by %s",
    async (method) => {
      const s = scenario([
        { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
        number,
        ask
      ]);
      await s.start();
      const bid = GameActionType.STAKE_BID_SUBMIT;
      await expect(s.send(bid, 3, { bidType: "normal", bidAmount: 150 })).rejects.toThrow(
        invalidState
      );
      await s.send(bid, 2, { bidType: "normal", bidAmount: 150 });
      expect(s.state.scriptProgress?.actorId).toBe(3);
      if (method === "timeout") {
        await s.expire();
      } else {
        await s.send(bid, 3, { bidType: "pass", bidAmount: null });
      }
      expect(s.state).toMatchObject({
        questionState: QuestionState.ANSWERING,
        answeringPlayer: 2,
        stakeQuestionData: { highestBid: 150, biddingPhase: false }
      });
      await s.send(GameActionType.ANSWER_SUBMITTED, 2, { answerText: "42" });
      expect(s.score(2)).toBe(350);
    }
  );

  it("publishes the actual opening price in a regular scripted auction", async () => {
    const s = scenario([
      { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
      ask
    ]);
    s.source.price = 100;
    s.source.realPrice = 500;
    s.game.getPlayer(2, { fetchDisconnected: false })!.score = 600;
    await s.start();

    const playerView = projectScriptState(s.game, 2);
    expect(playerView.currentQuestion?.price).toBe(100);
    expect(playerView.currentQuestion).not.toHaveProperty("realPrice");
    expect(playerView.stakeQuestionData?.questionPrice).toBe(500);

    const bid = GameActionType.STAKE_BID_SUBMIT;
    await expect(s.send(bid, 2, { bidType: "normal", bidAmount: 499 })).rejects.toThrow(
      ClientResponse.VALIDATION_ERROR
    );
    await s.send(bid, 2, { bidType: "normal", bidAmount: 500 });
    expect(s.state.stakeQuestionData?.highestBid).toBe(500);
  });

  it("waits for group final review, rejects review by players, and scores once", async () => {
    const s = scenario([everyone, number, ask], true);
    await s.start();
    const submit = GameActionType.FINAL_ANSWER_SUBMIT;
    const review = GameActionType.EVERYONE_ANSWER_REVIEW;
    await expect(s.send(review, 1, { playerId: 2, isCorrect: true })).rejects.toThrow(invalidState);
    await expect(s.send(submit, 1, { answerText: "42" })).rejects.toThrow(invalidState);
    await s.send(submit, 2, { answerText: "42" });
    await s.send(submit, 3, { answerText: "7" });
    expect(s.state).toMatchObject({ questionState: QuestionState.REVIEWING, timer: null });
    await expect(s.send(review, 3, { playerId: 2, isCorrect: true })).rejects.toThrow(invalidState);
    await s.send(review, 1, { playerId: 2, isCorrect: true });
    await expect(s.send(review, 1, { playerId: 2, isCorrect: true })).rejects.toThrow(invalidState);
    expect(s.score(2)).toBe(200);
    await s.send(review, 1, { playerId: 3, isCorrect: false });
    expect([s.score(2), s.score(3)]).toEqual([300, 200]);
  });

  it.each(["timeout", "skip", "leave", "leave with a pending answer"])(
    "makes only pending final submissions reviewable after %s",
    async (method) => {
      const s = scenario(
        [
          everyone,
          {
            op: "setAnswerType",
            answerType: "select",
            optionOrders: [0, 1],
            correctChoiceOrder: 1
          },
          ask
        ],
        true
      );
      s.source.answers = [
        { order: 0, text: "First", file: null },
        { order: 1, text: "Second", file: null }
      ];
      await s.start();
      const submit = GameActionType.FINAL_ANSWER_SUBMIT;
      for (const choiceOrder of [undefined, 2, 1.5]) {
        await expect(s.send(submit, 2, { choiceOrder })).rejects.toThrow(
          ClientResponse.VALIDATION_ERROR
        );
      }
      await s.send(submit, 2, { answerText: "Second", choiceOrder: 1 });
      const hadAnswer = method === "leave with a pending answer";
      if (hadAnswer) {
        await s.send(submit, 3, { answerText: "Second", choiceOrder: 1 });
        expect(s.state.allPlay?.entries[1]?.isCorrect).toBeNull();
      }
      const closing =
        method === "timeout"
          ? await s.expire()
          : method === "skip"
            ? await s.send(GameActionType.QUESTION_SKIP, 3)
            : await s.after(GameActionType.LEAVE, 3);
      expect(
        closing?.mutations.some((item) => item.type === DataMutationType.UPDATE_PLAYER_STATS)
      ).toBe(false);
      expect(s.state.questionState).toBe(QuestionState.REVIEWING);
      const entries = [
        { playerId: 2, choiceOrder: 1, submitted: true, isCorrect: null },
        { playerId: 3, choiceOrder: hadAnswer ? 1 : undefined, submitted: true, isCorrect: false }
      ];
      expect(s.state.allPlay?.entries).toMatchObject(entries);
      expect(projectScriptState(s.game, 1, true).allPlay?.entries).toMatchObject(entries);
      const review = GameActionType.EVERYONE_ANSWER_REVIEW;
      await expect(s.send(review, 1, { playerId: 3, isCorrect: true })).rejects.toThrow(
        invalidState
      );
      expect([s.score(2), s.score(3)]).toEqual([200, 300]);
      const ruling = s.context(review, 1, { playerId: 2, isCorrect: true });
      const ruled = await s.execute(ruling);
      expect(
        ruled?.mutations.filter((item) => item.type === DataMutationType.UPDATE_PLAYER_STATS)
      ).toMatchObject([
        { userId: 2, payload: { answerType: "correct", newScore: 300 } },
        { userId: 3, payload: { answerType: "wrong", newScore: 200 } }
      ]);
      await expect(s.execute(ruling)).rejects.toThrow(invalidState);
      expect([s.score(2), s.score(3)]).toEqual([300, 200]);
    }
  );

  it("lets the next final buzzer winner select the key forfeited by a departing player", async () => {
    const s = scenario(
      [
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        button
      ],
      true
    );
    s.source.answers = [
      { order: 0, text: "First", file: null },
      { order: 1, text: "Second", file: null }
    ];
    s.game.settings = { ...s.game.settings, buttonPressMode: ButtonPressMode.FIRST_WINS };
    await s.start();
    const buzz = GameActionType.QUESTION_ANSWER;
    const submit = GameActionType.ANSWER_SUBMITTED;
    await s.send(buzz, 2);
    await s.send(submit, 2, { answerText: "Second", choiceOrder: 1 });
    expect(s.state.scriptProgress?.submissions[0]?.correct).toBeNull();

    await s.after(GameActionType.LEAVE, 2);
    expect(s.state.questionState).toBe(QuestionState.SHOWING);
    expect(s.state.answeredPlayers).toMatchObject([{ player: 2, answerType: "wrong" }]);
    expect(s.state.answeredPlayers?.[0]?.choiceOrder).toBeUndefined();
    expect(projectScriptState(s.game, 3).answeredPlayers?.[0]?.choiceOrder).toBeUndefined();

    await s.send(buzz, 3);
    await s.send(submit, 3, { answerText: "Second", choiceOrder: 1 });
    await s.send(GameActionType.ANSWER_RESULT, 1, { answerType: "correct" });
    expect([s.score(2), s.score(3)]).toEqual([100, 400]);
  });

  it("rejects a non-text verdict before input and allows an oral text verdict", async () => {
    const verdict = GameActionType.ANSWER_RESULT;
    const numerical = scenario([current, number, ask]);
    await numerical.start();
    for (const answerType of ["correct", "wrong"]) {
      await expect(numerical.send(verdict, 1, { answerType })).rejects.toThrow(invalidState);
    }
    expect(numerical.score(2)).toBe(200);

    const oral = scenario([current, ask]);
    await oral.start();
    await oral.send(verdict, 1, { answerType: "correct" });
    expect(oral.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
    expect(oral.score(2)).toBe(300);
  });

  it.each(["number", "point", "select", "text"] as const)(
    "lets only the showman skip the current direct %s answer for zero before input",
    async (answerType) => {
      const format: QuestionScriptStep = answerType === "select"
        ? { op: "setAnswerType", answerType, optionOrders: [0, 1], correctChoiceOrder: 1 }
        : { op: "setAnswerType", answerType };
      const s = scenario([current, format, ask, ask]);
      s.source.answers = [
        { order: 0, text: "First", file: null },
        { order: 1, text: "Second", file: null }
      ];
      s.game.settings = { ...s.game.settings, wrongAnswerPenalty: WrongAnswerPenalty.SUBTRACT };
      await s.start();
      expect(s.state.answeringPlayer).toBe(2);
      const verdict = GameActionType.ANSWER_RESULT;
      const payload = { answerType: "skip", scoreResult: -100, playerId: 3 };
      const skip = s.context(verdict, 1, payload);
      await expect(s.send(verdict, 3, payload)).rejects.toThrow(invalidState);
      await expect(s.execute({ ...skip, action: { ...skip.action, scriptQuestionId: 99 } }))
        .rejects.toThrow(invalidState);
      s.state.isPaused = true;
      await expect(s.execute(skip)).rejects.toThrow(invalidState);
      s.state.isPaused = false;

      const result = await s.execute(skip);
      expect(result?.mutations.filter((item) => item.type === DataMutationType.UPDATE_PLAYER_STATS))
        .toMatchObject([{ userId: 2, payload: { answerType: "skip", newScore: 200 } }]);
      expect([s.score(2), s.score(3)]).toEqual([200, 300]);
      expect(s.state.scriptProgress?.programCounter).toBe(skip.action.scriptStep! + 1);
      expect(s.state.answeringPlayer).toBe(2);
      await expect(s.execute(skip)).rejects.toThrow(invalidState);
    }
  );

  it("keeps a skipped manual selection in history and lets the next player choose it", async () => {
    const s = scenario(
      [{ op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 }, button],
      true
    );
    s.source.answers = [
      { order: 0, text: "First", file: null },
      { order: 1, text: "Second", file: null }
    ];
    s.game.settings = {
      ...s.game.settings,
      buttonPressMode: ButtonPressMode.FIRST_WINS,
      wrongAnswerPenalty: WrongAnswerPenalty.SUBTRACT
    };
    await s.start();
    const buzz = GameActionType.QUESTION_ANSWER;
    const submit = GameActionType.ANSWER_SUBMITTED;
    const verdict = GameActionType.ANSWER_RESULT;
    const selection = { answerText: "Second", choiceOrder: 1 };
    await expect(s.send(verdict, 1, { answerType: "skip" })).rejects.toThrow(invalidState);
    await s.send(buzz, 2);
    await s.send(submit, 2, selection);
    await s.send(verdict, 1, { answerType: "skip" });

    expect(s.state.questionState).toBe(QuestionState.SHOWING);
    expect(projectScriptState(s.game, 3).answeredPlayers).toMatchObject([
      { player: 2, answerType: "skip", result: 0, score: 200, choiceOrder: 1 }
    ]);
    await expect(s.send(buzz, 2)).rejects.toThrow(invalidState);
    await s.send(buzz, 3);
    await s.send(submit, 3, selection);
    await s.send(verdict, 1, { answerType: "correct" });
    expect([s.score(2), s.score(3)]).toEqual([200, 400]);
  });

  it("undoes a direct skip once at reveal without reopening the ask", async () => {
    const s = scenario([current, number, ask]);
    await s.start();
    await s.send(GameActionType.ANSWER_RESULT, 1, { answerType: "skip" });
    expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
    expect(ShowmanToolsLogic.undoLastRuling(s.game)).toMatchObject({
      answerType: "skip",
      result: { playerId: 2, revertedResult: 0, newScore: 200, canAnswerAgain: false }
    });
    expect(() => ShowmanToolsLogic.undoLastRuling(s.game)).toThrow(ClientResponse.NOTHING_TO_UNDO);
    expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
  });

  it("draws no winner when the last press is withdrawn and leaves the remaining player eligible", async () => {
    const s = scenario([number, button]);
    s.game.settings = { ...s.game.settings, buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW };
    await s.start();
    await s.send(GameActionType.QUESTION_ANSWER, 2);
    await s.send(GameActionType.QUESTION_SKIP, 2);
    expect(s.state.buzzerWindow?.presses).toEqual([]);
    await s.expire();
    expect(s.state.questionState).toBe(QuestionState.SHOWING);
    expect(s.state.answeringPlayer).toBeNull();
    expect(s.score(2)).toBe(200);
    await s.send(GameActionType.QUESTION_ANSWER, 3);
    await s.expire();
    expect(s.state.answeringPlayer).toBe(3);
  });

  it("falls back to the current answer and stops before any later ask or award", async () => {
    const s = scenario([number, current, ask, ask, accept]);
    await s.start();
    const reveal = GameActionType.SKIP_QUESTION_FORCE;
    await expect(s.send(reveal, 2)).rejects.toThrow(invalidState);
    await s.send(reveal, 1);
    expect(s.state.answerShowData?.answerText).toBe("42");
    expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
    await s.send(GameActionType.SKIP_SHOW_ANSWER, 1);
    expect(s.state.scriptProgress).toBeNull();
    expect(s.score(2)).toBe(200);
  });

  it("can stop a script with no reveal without executing the remaining award", async () => {
    const s = scenario([current, ask, accept]);
    s.source.answerText = null;
    await s.start();
    expect(s.state.scriptView?.canReveal).toBe(false);
    await s.send(GameActionType.SKIP_QUESTION_FORCE, 1);
    expect(s.state).toMatchObject({
      questionState: QuestionState.SHOWING_ANSWER,
      scriptProgress: null,
      answerShowData: { answerText: null }
    });
    expect(s.score(2)).toBe(200);
  });

  it("keeps group stake amounts private until review and projects each real verdict amount", async () => {
    const s = scenario(
      [
        { op: "setAnswerer", mode: "stake", select: "allPossible", stakeVisibility: "hidden" },
        number,
        ask
      ],
      true
    );
    await s.start();
    await s.send(GameActionType.EVERYONE_STAKE_SUBMIT, 2, { amount: 150 });
    await s.send(GameActionType.EVERYONE_STAKE_SUBMIT, 3, { amount: 200 });
    const player = projectScriptState(s.game, 2);
    const publicView = projectScriptState(s.game);
    expect(player.allPlay?.entries.map((item) => item.stake)).toEqual([150, 0]);
    expect(player.scriptView?.scoreEstimate).toEqual({ win: 150, lose: -150 });
    expect(publicView.allPlay?.entries.map((item) => item.stake)).toEqual([0, 0]);
    expect(publicView.scriptView?.scoreEstimate).toBeUndefined();
    await s.send(GameActionType.FINAL_ANSWER_SUBMIT, 2, { answerText: "42" });
    expect(projectScriptState(s.game, 3).allPlay?.entries[0]?.answer).toBe("");
    await s.send(GameActionType.FINAL_ANSWER_SUBMIT, 3, { answerText: "7" });
    const host = projectScriptState(s.game, 1, true);
    expect(host.allPlay?.entries.map((item) => [item.stake, item.answer])).toEqual([
      [150, "42"],
      [200, "7"]
    ]);
    expect(host.scriptView?.reviewScoreEstimates).toEqual({
      2: { win: 150, lose: -150 },
      3: { win: 200, lose: -200 }
    });
  });

  it("resolves a paused price choice when the chooser leaves and reopens for the remaining group", async () => {
    const s = scenario([everyone, price, number, ask]);
    await s.start();
    expect(s.state.scriptProgress?.actorId).toBe(2);
    s.game.pause();
    s.game.removePlayer(2);
    await s.after(GameActionType.LEAVE, 2);
    expect(s.state.scriptProgress).toMatchObject({ waitingFor: "price", pendingDepartureIds: [2] });
    s.game.unpause();
    await s.after(GameActionType.UNPAUSE, 1);
    expect(s.state).toMatchObject({
      questionState: QuestionState.ANSWERING,
      currentQuestion: { realPrice: 100 },
      answeringPlayer: 3
    });
  });

  it("does not leave a later media step stuck when the viewers do not acknowledge it", async () => {
    const s = scenario([{ op: "showContent", phase: "question", orders: [0] }, current, ask]);
    s.source.questionFiles = [
      { order: 0, displayTime: null, file: { type: PackageFileType.IMAGE, md5: "map" } }
    ];
    await s.start();
    expect(s.state.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
    expect(s.state.questionTransition).toBeFalsy();
    await s.expire();
    expect(s.state.questionState).toBe(QuestionState.SHOWING);
    expect(await s.send(GameActionType.MEDIA_DOWNLOADED, 2)).toEqual({
      success: true,
      mutations: []
    });
    await s.expire();
    expect(s.state.questionState).toBe(QuestionState.ANSWERING);
  });

  it.each([ButtonPressMode.FIRST_WINS, ButtonPressMode.RANDOM_WITHIN_WINDOW])(
    "returns the buzzer to eligible players after a wrong answer (%s)",
    async (buttonPressMode) => {
      const s = scenario([number, button]);
      s.game.settings = { ...s.game.settings, buttonPressMode };
      await s.start();
      const buzz = GameActionType.QUESTION_ANSWER;
      await expect(s.send(buzz, 1)).rejects.toThrow(invalidState);
      await s.send(GameActionType.QUESTION_SKIP, 3);
      await expect(s.send(buzz, 3)).rejects.toThrow(invalidState);
      await s.send(GameActionType.QUESTION_UNSKIP, 3);
      await s.send(buzz, 2);
      if (buttonPressMode === ButtonPressMode.RANDOM_WITHIN_WINDOW) {
        expect(s.state.buzzerWindow?.presses).toEqual([2]);
        await s.expire();
      }
      expect(s.state.answeringPlayer).toBe(2);
      await s.send(GameActionType.ANSWER_SUBMITTED, 2, { answerText: "7" });
      expect(s.state.questionState).toBe(QuestionState.SHOWING);
      await expect(s.send(buzz, 2)).rejects.toThrow(invalidState);
      expect(s.score(2)).toBe(100);
      await s.expire();
      expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
    }
  );

  it("ignores unready opening expirations and accepts only eligible media reports while paused", async () => {
    const s = scenario([{ op: "showContent", phase: "question", orders: [0] }, current, ask]);
    s.state.questionState = QuestionState.CHOOSING;
    s.source.questionFiles = [
      { order: 0, displayTime: null, file: { type: PackageFileType.IMAGE, md5: "map" } }
    ];
    await s.start();
    const opening = s.state.questionTransition!;
    const ctx = s.expiration({ timerKey: questionTransitionTimerKey(s.game.id) });
    ctx.questionTransitionTimer = opening.timer;
    expect(await s.execute(ctx)).toEqual({ success: true, mutations: [] });
    expect(s.state.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
    s.game.pause();
    const media = GameActionType.MEDIA_DOWNLOADED;
    expect(await s.send(media, 1)).toEqual({ success: true, mutations: [] });
    await s.send(media, 2);
    expect(await s.send(media, 2)).toEqual({ success: true, mutations: [] });
    await s.send(media, 3);
    expect(s.state.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
    s.game.unpause();
    await s.after(GameActionType.UNPAUSE, 1);
    expect(opening.mediaReady).toBe(true);
    expect(s.state.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
    opening.timer.startedAt = new Date(0);
    await s.execute(s.expiration({ timerKey: questionTransitionTimerKey(s.game.id) }));
    expect(s.state.questionState).toBe(QuestionState.SHOWING);
    await s.send(GameActionType.SKIP_SHOW_ANSWER, 1);
    expect(s.state.questionState).toBe(QuestionState.ANSWERING);
  });

  it("does not treat a disconnect with a retained seat as a departure", async () => {
    const s = scenario([everyone, number, ask]);
    await s.start();
    await s.after(GameActionType.DISCONNECT, 3);
    expect(s.state.scriptProgress?.submissions).toEqual([]);
    s.game.getPlayer(3, { fetchDisconnected: false })!.role = PlayerRole.SPECTATOR;
    await s.after(GameActionType.PLAYER_ROLE_CHANGE, 1, { playerId: 3 });
    expect(s.state.scriptProgress?.submissions).toEqual([
      {
        playerId: 3,
        answerText: null,
        choiceOrder: null,
        correct: false,
        scored: false,
        unanswered: true
      }
    ]);
    await s.send(GameActionType.EVERYONE_ANSWER_SUBMIT, 2, { answerText: "42" });
    expect(s.state.questionState).toBe(QuestionState.SHOWING_ANSWER);
  });
});
