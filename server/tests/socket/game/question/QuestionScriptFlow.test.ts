import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { container } from "tsyringe";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import type { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import type { QuestionScriptScoreEffect } from "domain/logic/question/QuestionScriptLogic";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

interface ScriptState {
  gameState: GameStateDTO;
  scores: { playerId: number; score: number }[];
  outcomes: QuestionScriptScoreEffect[];
}

describe("Typed question script transport", () => {
  let suite: SocketGameTestSuite;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
  });
  afterEach(async () => {
    if (suite) suite.utils.packageTransform = null;
    await suite?.reset();
  });
  afterAll(async () => {
    await suite?.stop();
  });

  it.each([true, false])("routes final selection with explicit script=%s", async (explicit) => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const final = pkg.rounds.find((round) => round.type === "final")!;
        final.themes = final.themes.slice(0, 2);
        if (!explicit) return;
        final.themes[1].questions[0].script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "current" },
            { op: "setPrice", mode: "select", range: { min: 0, max: 0, step: 0 } },
            { op: "askAnswer", mode: "direct", durationMs: 15000 }
          ]
        };
      };
      const { gameId, showmanSocket, playerSockets, playerUsers } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 1, 0, true);
      await utils.startGame(showmanSocket);
      const game = await utils.getGameFromGameService(gameId);
      game.players.find((player) => player.meta.id === playerUsers[0].id)!.score = 500;
      await suite.testUtils.updateGame(game);
      const playerSocket = playerSockets[0];
      await utils.progressToNextRound(showmanSocket);
      const themes = (await utils.getGameState(gameId))!.currentRound!.themes;
      expect(themes).toHaveLength(2);
      const beforeElimination = scenario.mark();
      const eliminationAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.THEME_ELIMINATE })
        .waitForCount(1);
      const eliminate = () =>
        scenario
          .actor(playerSocket)
          .emit(SocketIOGameEvents.THEME_ELIMINATE, { themeId: themes[0].id });
      if (!explicit) {
        const bidding = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        eliminate();
        await Promise.all([bidding, eliminationAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        expect((await utils.getGameState(gameId))?.finalRoundData?.phase).toBe("bidding");
        return;
      }
      const entering = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      eliminate();
      const [initial] = await Promise.all([entering, eliminationAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(initial.gameState.currentRound?.type).toBe("final");
      expect(initial.gameState.finalRoundData).toBeNull();
      expect(initial.gameState.scriptFinalBids).toEqual({});
      expect(initial.gameState.scriptView).toMatchObject({
        programCounter: 3,
        waitingFor: "answer"
      });
      const commands = {
        scriptQuestionId: initial.gameState.scriptView!.questionId,
        scriptStep: 3
      };
      const submitting = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      scenario
        .actor(playerSocket)
        .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { ...commands, answerText: "test" });
      await submitting;
      expect(initial.gameState.currentQuestion?.realPrice).toBe(1);
      const reviewed = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const finished = scenario.waitForEvent(playerSocket, SocketIOGameEvents.GAME_FINISHED);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
        ...commands,
        answerType: "correct",
        scoreResult: 1
      });
      const [outcome] = await Promise.all([reviewed, finished]);
      expect(outcome.outcomes).toEqual([
        { playerId: playerUsers[0].id, answerType: "correct", change: 1, score: 501 }
      ]);
      await scenario.assert.waitForActionsComplete({ gameId });
      await scenario.assert.noInbound({
        actor: scenario.actor(playerSocket),
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        afterSequence: beforeElimination,
        durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
      });
    });
  });

  it.each([true, false])(
    "prepares only the active select group before the ask (with prompt=%s)",
    async (withPrompt) => {
      await suite.scenario(async (scenario) => {
        const { utils } = suite;
        const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
          suite.userRepo,
          suite.app,
          1,
          0
        );
        await utils.startGame(showmanSocket);
        const questionId = (await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId))!
          .id!;
        const store = container.resolve(PackageStore);
        const source = (await store.getQuestionWithTheme(gameId, questionId))!.question;
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${questionId}`]: JSON.stringify({
            ...source,
            questionFiles: [],
            textItems: [{ order: 0, text: "Prompt", durationMs: 20_000 }],
            answers: [
              { order: 0, text: "A", file: null },
              {
                order: 1,
                text: null,
                file: {
                  md5: "option-audio",
                  type: PackageFileType.AUDIO,
                  link: "https://example.test/option.mp3"
                }
              },
              { order: 2, text: "C", file: null },
              {
                order: 3,
                text: null,
                file: {
                  md5: "future-audio",
                  type: PackageFileType.AUDIO,
                  link: "https://example.test/future.mp3"
                }
              }
            ],
            script: {
              version: 1,
              steps: [
                { op: "setAnswerer", mode: "current" },
                {
                  op: "setAnswerType",
                  answerType: "select",
                  optionOrders: [0, 1],
                  correctChoiceOrder: 1
                },
                ...(withPrompt ? [{ op: "showContent", phase: "question", orders: [0] }] : []),
                { op: "askAnswer", mode: "direct", durationMs: 15_000 },
                {
                  op: "setAnswerType",
                  answerType: "select",
                  optionOrders: [2, 3],
                  correctChoiceOrder: 3
                },
                { op: "askAnswer", mode: "direct", durationMs: 14_000 }
              ]
            }
          })
        });
        const socket = playerSockets[0];
        const next = () =>
          scenario.waitForEvent<ScriptState>(socket, SocketIOGameEvents.QUESTION_SCRIPT_STATE);
        const first = next();
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
        const initial = (await first).gameState;
        expect(initial.questionState).toBe("media_downloading");
        expect(initial.timer?.durationMs).toBe(30_000);
        expect(initial.currentQuestion?.answers?.map((answer) => answer.order)).toEqual([0, 1]);
        expect(initial.currentQuestion).not.toHaveProperty("correctChoiceOrder");
        const ack = next();
        scenario.actor(socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED, {
          scriptQuestionId: questionId,
          scriptStep: initial.scriptView!.programCounter,
          mediaDurations: [{ md5: "option-audio", durationMs: 1200 }]
        });
        await ack;
        const afterOpening = next();
        await suite.testUtils.expireTimer(gameId, "question-transition");
        let active = (await afterOpening).gameState;
        if (withPrompt) {
          expect(active.questionState).toBe("showing");
          expect(active.questionContentPlan?.totalMs).toBe(20_000);
          await scenario.assert.waitForActionsComplete({ gameId });
          const game = await utils.getGameFromGameService(gameId);
          game.gameState.timer!.startedAt = new Date(Date.now() - game.gameState.timer!.durationMs);
          await suite.testUtils.updateGame(game);
          const afterPrompt = next();
          await suite.testUtils.expireTimer(gameId);
          active = (await afterPrompt).gameState;
        }
        expect(active.questionState).toBe("answering");
        expect(active.timer?.durationMs).toBe(15_000);
        expect(active.mediaDurations).not.toHaveProperty("option-audio");

        const changing = next();
        scenario.actor(socket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          answerText: null,
          choiceOrder: 1,
          scriptQuestionId: questionId,
          scriptStep: active.scriptView!.programCounter
        });
        const second = (await changing).gameState;
        expect(second.questionState).toBe("media_downloading");
        expect(second.currentQuestion?.answers?.map((answer) => answer.order)).toEqual([2, 3]);
        const timedOut = next();
        await suite.testUtils.expireTimer(gameId);
        const afterTimeout = (await timedOut).gameState;
        expect(afterTimeout.questionState).toBe("answering");
        expect(afterTimeout.timer?.durationMs).toBe(14_000);
      });
    }
  );

  it("resumes after an explicit departure while a paused script waits for a verdict", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes[0].questions.find(
          (item) => item.type === PackageQuestionType.SIMPLE
        )!;
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "current" },
            { op: "askAnswer", mode: "direct", durationMs: 15_000 }
          ]
        };
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 0);
      await utils.startGame(showmanSocket);
      const questionId = (await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId))!.id!;
      const next = () =>
        scenario.waitForEvent<ScriptState>(showmanSocket, SocketIOGameEvents.QUESTION_SCRIPT_STATE);
      const picked = next();
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
      const first = (await picked).gameState;
      const player = playerSockets[playerUsers.findIndex(({ id }) => id === first.answeringPlayer)];
      const submitted = next();
      scenario.actor(player).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "oral",
        scriptQuestionId: questionId,
        scriptStep: first.scriptView!.programCounter
      });
      expect((await submitted).gameState.timer).toBeNull();
      const paused = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.GAME_PAUSE);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
      await paused;
      const left = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      scenario.actor(player).emit(SocketIOGameEvents.LEAVE);
      await left;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))?.scriptProgress?.pendingDepartureIds).toEqual([
        first.answeringPlayer
      ]);
      const resumed = next();
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
      const state = (await resumed).gameState;
      expect(state.isPaused).toBe(false);
      expect(state.answeringPlayer).toBeNull();
      expect(state.scriptView?.waitingFor).toBeNull();
    });
  });

  it("continues two asks, rejects an old step retry and records score-only accept", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes[0].questions.find(
          (q) => q.type === PackageQuestionType.SIMPLE
        )!;
        question.answerType = AnswerType.NUMBER;
        question.answerNumber = 42;
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerType", answerType: "number" },
            { op: "setAnswerer", mode: "current" },
            { op: "askAnswer", mode: "direct", durationMs: 15000 },
            { op: "askAnswer", mode: "direct", durationMs: 15000 },
            { op: "accept" }
          ]
        };
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 1, 0);
      await utils.startGame(showmanSocket);
      const playerSocket = playerSockets[0];
      const playerId = playerUsers[0].id;
      const question = await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId);
      const initial = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const pickAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.QUESTION_PICK })
        .waitForCount(1);
      scenario
        .actor(showmanSocket)
        .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: question!.id });
      const [first] = await Promise.all([initial, pickAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(first.gameState.scriptView).toMatchObject({ programCounter: 3, waitingFor: "answer" });
      expect(first.gameState).not.toHaveProperty("scriptProgress");
      expect(first.gameState.currentQuestion).not.toHaveProperty("answerNumber");

      const spectator = await utils.createGameClient(suite.app, suite.userRepo);
      const rejoin = await utils.joinSpecificGameWithData(
        spectator.socket,
        gameId,
        PlayerRole.SPECTATOR
      );
      expect(rejoin.gameState.scriptView).toEqual(first.gameState.scriptView);
      expect(rejoin.gameState.currentRound?.themes[0].questions).toContainEqual(
        expect.objectContaining({ id: question!.id, price: 100 })
      );
      expect(rejoin.gameState).not.toHaveProperty("scriptProgress");

      const actionType = GameActionType.ANSWER_SUBMITTED;
      const firstAnswer = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const firstAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType })
        .waitForCount(1);
      scenario.actor(playerSocket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "42",
        scriptStep: 3,
        scriptQuestionId: question!.id
      });
      const [second] = await Promise.all([firstAnswer, firstAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(second.gameState.scriptView?.programCounter).toBe(4);
      expect(second.outcomes).toEqual([
        { playerId, answerType: "correct", change: 100, score: 100 }
      ]);

      const retryError = scenario.waitForEvent(playerSocket, SocketIOEvents.ERROR);
      const retryAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType })
        .waitForCount(1);
      scenario.actor(playerSocket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "42",
        scriptStep: 3,
        scriptQuestionId: question!.id
      });
      await Promise.all([retryError, retryAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))?.scriptProgress?.programCounter).toBe(4);

      const lastAnswer = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const lastAccepted = scenario
        .createAcceptedActionProbe({ gameId, actionType })
        .waitForCount(1);
      scenario.actor(playerSocket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        answerText: "7",
        scriptStep: 4,
        scriptQuestionId: question!.id
      });
      const [last] = await Promise.all([lastAnswer, lastAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(last.outcomes).toEqual([
        { playerId, answerType: "wrong", change: -100, score: 0 },
        { playerId, answerType: null, change: 100, score: 100 }
      ]);
      expect(last.gameState.answerShowData).toMatchObject({
        answerResult: { player: playerId, answerType: "correct", result: 100, score: 100 }
      });
      expect(last.gameState.answerShowData).not.toHaveProperty("answerResult.answerText");
      expect(
        await container.resolve(PlayerGameStatsRepository).getStats(gameId, playerId)
      ).toMatchObject({
        questionsAnswered: "2",
        correctAnswers: "1",
        wrongAnswers: "1",
        currentScore: "100"
      });
    });
  });
});
