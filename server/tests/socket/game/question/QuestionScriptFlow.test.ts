import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { container } from "tsyringe";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import type { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import type { QuestionScriptScoreEffect } from "domain/logic/question/QuestionScriptLogic";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { PlayerRole } from "domain/types/game/PlayerRole";
import type { AnswerResultUndoEventPayload } from "domain/types/socket/events/game/ShowmanToolsEventPayloads";
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

  it("skips a direct ask with no eligible transfer recipient", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes[0].questions.find(
          (item) => item.type === PackageQuestionType.SIMPLE
        )!;
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "byCurrent", select: "exceptCurrent" },
            { op: "askAnswer", mode: "direct", durationMs: 15_000 },
            { op: "accept" }
          ]
        };
      };
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 1, 0);
      await utils.startGame(showmanSocket);
      const question = await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId);
      const stateEvent = scenario.waitForEvent<ScriptState>(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const accepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.QUESTION_PICK })
        .waitForCount(1);
      scenario
        .actor(showmanSocket)
        .emit(SocketIOGameEvents.QUESTION_PICK, { questionId: question!.id });
      const [result] = await Promise.all([stateEvent, accepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(result.gameState).toMatchObject({
        questionState: "showing_answer",
        answeringPlayer: null,
        scriptView: { waitingFor: null, answererIds: [] }
      });
      expect(result.outcomes).toEqual([]);
      const game = await utils.getGameFromGameService(gameId);
      expect(game.getPlayer(playerUsers[0].id, { fetchDisconnected: true })?.score).toBe(0);
      expect(game.gameState.scriptProgress).toBeNull();
    });
  });

  it.each([true, false])("routes final selection with explicit script=%s", async (explicit) => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const final = pkg.rounds.find((round) => round.type === "final")!;
        final.themes = final.themes.slice(0, 2);
        if (!explicit) return;
        const question = final.themes[1].questions[0];
        question.answers = [
          { order: 0, text: "A", file: null },
          { order: 1, text: "B", file: null }
        ];
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "current" },
            { op: "setPrice", mode: "select", range: { min: 0, max: 0, step: 0 } },
            {
              op: "setAnswerType",
              answerType: "select",
              optionOrders: [0, 1],
              correctChoiceOrder: 1
            },
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
        scenario.actor(playerSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
          themeId: themes.find((theme) => theme.name === "Final Theme 1")!.id
        });
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
        programCounter: 4,
        waitingFor: "answer"
      });
      const commands = {
        scriptQuestionId: initial.gameState.scriptView!.questionId,
        scriptStep: initial.gameState.scriptView!.programCounter
      };
      const answerAction = GameActionType.ANSWER_SUBMITTED;
      const rejected = scenario.waitForEvent(playerSocket, SocketIOEvents.ERROR);
      const rejectedAction = scenario
        .createAcceptedActionProbe({ gameId, actionType: answerAction })
        .waitForCount(1);
      scenario.actor(playerSocket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        ...commands,
        answerText: "B",
        choiceOrder: 0
      });
      await Promise.all([rejected, rejectedAction]);
      await scenario.assert.waitForActionsComplete({ gameId });
      const unchanged = await utils.getGameState(gameId);
      expect(unchanged?.scriptProgress?.submissions).toEqual([]);
      expect(unchanged?.submittedAnswer).toBeUndefined();
      expect(unchanged?.submittedChoiceOrder).toBeUndefined();

      const submitting = scenario.waitForEvent<ScriptState>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const submittedAction = scenario
        .createAcceptedActionProbe({ gameId, actionType: answerAction })
        .waitForCount(1);
      scenario.actor(playerSocket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
        ...commands,
        answerText: "A",
        choiceOrder: 0
      });
      const [submitted] = await Promise.all([submitting, submittedAction]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(submitted.gameState).toMatchObject({
        submittedAnswer: "A",
        submittedChoiceOrder: 0
      });
      expect(submitted.outcomes).toEqual([]);
      expect(initial.gameState.currentQuestion?.realPrice).toBe(1);
      const reviewed = scenario.waitForEvent<ScriptState>(
        playerSocket,
        SocketIOGameEvents.QUESTION_SCRIPT_STATE
      );
      const finished = scenario.waitForEvent(playerSocket, SocketIOGameEvents.GAME_FINISHED);
      const verdictAction = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_RESULT })
        .waitForCount(1);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
        ...commands,
        answerType: "correct",
        scoreResult: 1
      });
      const [outcome] = await Promise.all([reviewed, finished, verdictAction]);
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

  it("publishes the scripted final auction minimum and advances after a bid and a timeout", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      const auctionThemeName = "Scripted final auction";
      utils.packageTransform = (pkg) => {
        const final = pkg.rounds.find((round) => round.type === "final")!;
        final.themes = final.themes.slice(0, 2);
        const auctionTheme = final.themes[1];
        auctionTheme.name = auctionThemeName;
        const question = auctionTheme.questions[0];
        question.price = null;
        question.realPrice = 100;
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
            { op: "askAnswer", mode: "direct", durationMs: null }
          ]
        };
      };
      const { gameId, showmanSocket, playerSockets, playerUsers } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 3, 0, true);
      await utils.startGame(showmanSocket);
      const game = await utils.getGameFromGameService(gameId);
      for (const { id } of playerUsers) {
        game.players.find((player) => player.meta.id === id)!.score = 500;
      }
      await suite.testUtils.updateGame(game);
      await utils.progressToNextRound(showmanSocket);
      const state = (await utils.getGameState(gameId))!;
      const themes = state.currentRound!.themes;
      expect(themes).toHaveLength(2);
      const auctionTheme = themes.find((theme) => theme.name === auctionThemeName)!;
      expect(auctionTheme?.questions).toHaveLength(1);
      const [question] = auctionTheme.questions;
      const eliminatedTheme = themes.find((theme) => theme.id !== auctionTheme.id)!;
      const stored = await container
        .resolve(PackageStore)
        .getQuestionWithTheme(gameId, question.id);
      expect(stored).toMatchObject({
        theme: { id: auctionTheme.id },
        question: { id: question.id, price: null, realPrice: 100, script: { version: 1 } }
      });
      const opener = state.finalRoundData!.turnOrder[0];
      const socketFor = (id: number) =>
        playerSockets[playerUsers.findIndex((user) => user.id === id)];
      const update = (id: number) =>
        scenario.waitForEvent<ScriptState>(socketFor(id), SocketIOGameEvents.QUESTION_SCRIPT_STATE);
      const accepted = (actionType: GameActionType) =>
        scenario.createAcceptedActionProbe({ gameId, actionType }).waitForCount(1);

      const opening = update(opener);
      const eliminationAccepted = accepted(GameActionType.THEME_ELIMINATE);
      scenario.actor(socketFor(opener)).emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: eliminatedTheme.id
      });
      const [{ gameState: initial }] = await Promise.all([opening, eliminationAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(initial.finalRoundData).toBeNull();
      expect(initial.scriptView).toMatchObject({ questionId: question.id, actorId: opener });
      expect(initial.stakeQuestionData).toMatchObject({
        questionId: question.id,
        questionPrice: 100,
        currentBidderIndex: 0,
        biddingPhase: true,
        highestBid: null
      });
      expect(initial.currentQuestion?.price).toBeNull();
      expect(initial.currentQuestion).not.toHaveProperty("realPrice");
      expect(initial.currentQuestion).not.toHaveProperty("script");
      expect(initial).not.toHaveProperty("scriptProgress");
      expect(initial.scriptFinalBids).toEqual({});
      expect(initial.currentRound!.themes.every((theme) => theme.questions.length === 0)).toBe(
        true
      );
      const [first, second, third] = initial.stakeQuestionData!.biddingOrder;
      expect(first).toBe(opener);
      const commands = {
        scriptQuestionId: initial.scriptView!.questionId,
        scriptStep: initial.scriptView!.programCounter
      };
      const bid = (id: number, amount: number) =>
        scenario.actor(socketFor(id)).emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          ...commands,
          bidType: "normal",
          bidAmount: amount
        });

      const nextBid = update(second);
      const bidAccepted = accepted(GameActionType.STAKE_BID_SUBMIT);
      bid(first, 100);
      const [{ gameState: afterBid }] = await Promise.all([nextBid, bidAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(afterBid.scriptView?.actorId).toBe(second);
      expect(afterBid.stakeQuestionData).toMatchObject({ currentBidderIndex: 1, highestBid: 100 });

      const nextAfterTimeout = update(third);
      const timeoutAccepted = accepted(GameActionType.TIMER_BIDDING_EXPIRED);
      await suite.testUtils.expireTimer(gameId);
      const [{ gameState: afterTimeout }] = await Promise.all([nextAfterTimeout, timeoutAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(afterTimeout.scriptView?.actorId).toBe(third);
      expect(afterTimeout.stakeQuestionData).toMatchObject({
        currentBidderIndex: 2,
        passedPlayers: [second],
        highestBid: 100
      });

      const thirdBid = update(first);
      const thirdAccepted = accepted(GameActionType.STAKE_BID_SUBMIT);
      bid(third, 101);
      const [{ gameState: afterThirdBid }] = await Promise.all([thirdBid, thirdAccepted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(afterThirdBid.stakeQuestionData?.bids).toEqual({
        [first]: 100,
        [second]: null,
        [third]: 101
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
              { order: 0, text: "2", file: null },
              {
                order: 1,
                text: null,
                file: {
                  md5: "option-audio",
                  type: PackageFileType.AUDIO,
                  link: "https://example.test/option.mp3"
                }
              },
              { order: 2, text: "#2", file: null },
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
          answerText: "#2",
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

  it("projects a timed-out final answer as terminal and records both verdicts once", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const final = pkg.rounds.find((round) => round.type === "final")!;
        final.themes = final.themes.slice(0, 2);
        const question = final.themes[1].questions[0];
        question.realPrice = 100;
        question.answerText = "Answer";
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "all" },
            { op: "askAnswer", mode: "direct", durationMs: 15000 },
            { op: "showContent", phase: "answer", orders: [], revealRight: true }
          ]
        };
      };
      const { gameId, showmanSocket, playerSockets, playerUsers, showmanUser } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 0, true);
      await utils.startGame(showmanSocket);
      const game = await utils.getGameFromGameService(gameId);
      for (const player of game.players.filter((item) => item.role === PlayerRole.PLAYER)) {
        player.score = 500;
      }
      await suite.testUtils.updateGame(game);
      await utils.progressToNextRound(showmanSocket);

      const next = (socket = showmanSocket) =>
        scenario.waitForEvent<ScriptState>(socket, SocketIOGameEvents.QUESTION_SCRIPT_STATE);
      const round = (await utils.getGameState(gameId))!.currentRound!;
      const entering = next();
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: round.themes.find((theme) => theme.name === "Final Theme 1")!.id
      });
      const first = (await entering).gameState;
      const identity = {
        scriptQuestionId: first.scriptView!.questionId,
        scriptStep: first.scriptView!.programCounter
      };
      const [responded, expired] = playerUsers.map(({ id }) => id);
      const pending = next();
      scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ALL_PLAY_ANSWER, {
        ...identity,
        answerText: "Answer"
      });
      await pending;
      await scenario.assert.waitForActionsComplete({ gameId });

      const review = next();
      await suite.testUtils.expireTimer(gameId);
      const reviewState = (await review).gameState;
      const entries = [
        { playerId: responded, submitted: true, isCorrect: null, answer: "Answer" },
        { playerId: expired, submitted: true, isCorrect: false, answer: null }
      ];
      expect(reviewState.questionState).toBe("reviewing");
      expect(reviewState.allPlay?.entries).toEqual(
        expect.arrayContaining(entries.map((entry) => expect.objectContaining(entry)))
      );
      await scenario.assert.waitForActionsComplete({ gameId });
      const repo = container.resolve(PlayerGameStatsRepository);
      expect((await repo.getStats(gameId, expired))?.questionsAnswered ?? "0").toBe("0");

      const { socket: rejoined } = await utils.createSocketForExistingUser(
        suite.app,
        showmanUser.id
      );
      const snapshot = await utils.joinSpecificGameWithData(rejoined, gameId, PlayerRole.SHOWMAN);
      expect(snapshot.gameState.allPlay?.entries).toEqual(reviewState.allPlay?.entries);
      await scenario.emitAndWaitForEvent(rejoined, SocketIOEvents.ERROR, () =>
        scenario.actor(rejoined).emit(SocketIOGameEvents.ALL_PLAY_REVIEW, {
          ...identity,
          playerId: expired,
          isCorrect: true
        })
      );
      const ruled = next(rejoined);
      scenario.actor(rejoined).emit(SocketIOGameEvents.ALL_PLAY_REVIEW, {
        ...identity,
        playerId: responded,
        isCorrect: true
      });
      expect((await ruled).outcomes).toEqual(
        expect.arrayContaining([
          { playerId: responded, answerType: "correct", change: 100, score: 600 },
          { playerId: expired, answerType: "wrong", change: -100, score: 400 }
        ])
      );
      await scenario.emitAndWaitForEvent(rejoined, SocketIOEvents.ERROR, () =>
        scenario.actor(rejoined).emit(SocketIOGameEvents.ALL_PLAY_REVIEW, {
          ...identity,
          playerId: responded,
          isCorrect: true
        })
      );
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(await repo.getStats(gameId, responded)).toMatchObject({
        questionsAnswered: "1",
        correctAnswers: "1",
        wrongAnswers: "0",
        currentScore: "600"
      });
      expect(await repo.getStats(gameId, expired)).toMatchObject({
        questionsAnswered: "1",
        correctAnswers: "0",
        wrongAnswers: "1",
        currentScore: "400"
      });
    });
  });

  it("broadcasts and undoes a neutral showman skip before scripted input", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes[0].questions.find(
          (item) => item.type === PackageQuestionType.SIMPLE
        )!;
        question.answerNumber = 42;
        question.script = {
          version: 1,
          steps: [
            { op: "setAnswerType", answerType: "number" },
            { op: "askAnswer", mode: "button", durationMs: 15000 }
          ]
        };
      };
      const { gameId, showmanSocket, playerSockets, playerUsers } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 0);
      await utils.startGame(showmanSocket);
      const game = await utils.getGameFromGameService(gameId);
      game.settings = {
        ...game.settings,
        buttonPressMode: ButtonPressMode.FIRST_WINS,
        wrongAnswerPenalty: WrongAnswerPenalty.SUBTRACT
      };
      await suite.testUtils.updateGame(game);
      const questionId = (await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId))!.id!;
      const [first, second] = playerSockets;
      const playerId = playerUsers[0].id;
      const accepted = (actionType: GameActionType) =>
        scenario.createAcceptedActionProbe({ gameId, actionType }).waitForCount(1);
      const next = async (actionType: GameActionType, emit: () => void) => {
        const queued = accepted(actionType);
        const received = scenario.waitForEvent<ScriptState>(
          playerSockets[1],
          SocketIOGameEvents.QUESTION_SCRIPT_STATE
        );
        emit();
        const [result] = await Promise.all([received, queued]);
        await scenario.assert.waitForActionsComplete({ gameId });
        return result;
      };
      const initial = await next(GameActionType.QUESTION_PICK, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
      );
      const identity = {
        scriptQuestionId: questionId,
        scriptStep: initial.gameState.scriptView!.programCounter
      };
      const buzz = () =>
        next(GameActionType.QUESTION_ANSWER, () =>
          scenario.actor(first).emit(SocketIOGameEvents.QUESTION_ANSWER, identity)
        );
      expect((await buzz()).gameState.answeringPlayer).toBe(playerId);
      expect((await utils.getGameState(gameId))?.scriptProgress?.submissions).toEqual([]);

      const mark = scenario.mark();
      const skipped = await next(GameActionType.ANSWER_RESULT, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          ...identity,
          answerType: "skip",
          scoreResult: 0
        })
      );
      scenario.assert.expectDirectedEventCount({
        actor: scenario.actor(second),
        direction: "inbound",
        event: SocketIOGameEvents.QUESTION_SCRIPT_STATE,
        afterSequence: mark,
        expectedCount: 1
      });
      expect(skipped.outcomes).toEqual([{ playerId, answerType: "skip", change: 0, score: 0 }]);
      expect(skipped.gameState).toMatchObject({
        questionState: "showing",
        answeringPlayer: null,
        scriptView: { programCounter: identity.scriptStep, waitingFor: "answer" },
        answeredPlayers: [{ player: playerId, answerType: "skip", result: 0 }]
      });
      const stats = container.resolve(PlayerGameStatsRepository);
      expect(await stats.getStats(gameId, playerId)).toMatchObject({
        questionsAnswered: "1",
        correctAnswers: "0",
        wrongAnswers: "0",
        currentScore: "0"
      });

      const undoQueued = accepted(GameActionType.LAST_ANSWER_RULING_REVERT);
      const undone = scenario.waitForEvent<AnswerResultUndoEventPayload>(
        playerSockets[1],
        SocketIOGameEvents.ANSWER_RESULT_UNDO
      );
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO, identity);
      const [undo] = await Promise.all([undone, undoQueued]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(undo).toEqual({ playerId, revertedResult: 0, newScore: 0, canAnswerAgain: true });
      expect(await stats.getStats(gameId, playerId)).toMatchObject({
        questionsAnswered: "0",
        correctAnswers: "0",
        wrongAnswers: "0"
      });
      expect((await buzz()).gameState.answeringPlayer).toBe(playerId);
    });
  });

  it("undoes a scripted select ruling through Socket.IO and reopens the buzzer on rejoin", async () => {
    await suite.scenario(async (scenario) => {
      const { utils } = suite;
      utils.packageTransform = (pkg) => {
        const question = pkg.rounds[0].themes[0].questions.find(
          (item) => item.type === PackageQuestionType.SIMPLE
        )!;
        question.answers = [
          { order: 0, text: "First", file: null },
          { order: 1, text: "Second", file: null }
        ];
        question.script = {
          version: 1,
          steps: [
            {
              op: "setAnswerType",
              answerType: "select",
              optionOrders: [0, 1],
              correctChoiceOrder: 1
            },
            { op: "askAnswer", mode: "button", durationMs: 15000 },
            { op: "askAnswer", mode: "button", durationMs: 15000 }
          ]
        };
      };
      const { gameId, showmanSocket, playerSockets, playerUsers } =
        await utils.setupGameTestEnvironment(suite.userRepo, suite.app, 2, 0);
      await utils.startGame(showmanSocket);
      const game = await utils.getGameFromGameService(gameId);
      game.settings = { ...game.settings, buttonPressMode: ButtonPressMode.FIRST_WINS };
      await suite.testUtils.updateGame(game);
      const questionId = (await utils.findQuestionByType(PackageQuestionType.SIMPLE, gameId))!.id!;
      const [first, second] = playerSockets;
      const [playerId, otherId] = playerUsers.map(({ id }) => id);
      const next = (emit: () => void) =>
        scenario.emitAndWaitForEvent<ScriptState>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SCRIPT_STATE,
          emit
        );
      const initial = await next(() =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
      );
      const identity = {
        scriptQuestionId: questionId,
        scriptStep: initial.gameState.scriptView!.programCounter
      };

      const buzz = (socket: typeof first, step = identity) =>
        next(() => scenario.actor(socket).emit(SocketIOGameEvents.QUESTION_ANSWER, step));
      const pick = (socket: typeof first, choiceOrder: number, step = identity) =>
        scenario.actor(socket).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
          ...step,
          choiceOrder,
          answerText: choiceOrder === 0 ? "First" : "Second"
        });
      expect((await buzz(first)).gameState.answeringPlayer).toBe(playerId);
      const wrong = await next(() => pick(first, 0));
      expect(wrong.gameState.answeredPlayers).toMatchObject([{ player: playerId, choiceOrder: 0 }]);
      expect(wrong.outcomes).toEqual([
        { playerId, answerType: "wrong", change: -100, score: -100 }
      ]);
      await scenario.assert.waitForActionsComplete({ gameId });
      const repo = container.resolve(PlayerGameStatsRepository);
      expect(await repo.getStats(gameId, playerId)).toMatchObject({
        questionsAnswered: "1",
        wrongAnswers: "1",
        currentScore: "-100"
      });

      const undo = () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO, identity);
      await scenario.emitAndWaitForEvent(first, SocketIOEvents.ERROR, () =>
        scenario.actor(first).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO, identity)
      );
      const reverted = await scenario.emitAndWaitForEvent<AnswerResultUndoEventPayload>(
        first,
        SocketIOGameEvents.ANSWER_RESULT_UNDO,
        undo
      );
      expect(reverted).toEqual({
        playerId,
        revertedResult: -100,
        newScore: 0,
        canAnswerAgain: true
      });
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, undo);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(await repo.getStats(gameId, playerId)).toMatchObject({
        questionsAnswered: "0",
        wrongAnswers: "0",
        currentScore: "0"
      });

      const { socket: rejoined } = await utils.createSocketForExistingUser(suite.app, playerId);
      const snapshot = await utils.joinSpecificGameWithData(rejoined, gameId, PlayerRole.PLAYER);
      expect(snapshot.gameState.answeredPlayers).toBeNull();
      expect(snapshot.gameState.scriptView?.programCounter).toBe(identity.scriptStep);
      expect((await buzz(rejoined)).gameState.answeringPlayer).toBe(playerId);
      expect((await next(() => pick(rejoined, 0))).outcomes).toEqual(wrong.outcomes);
      expect((await buzz(second)).gameState.answeringPlayer).toBe(otherId);
      await scenario.emitAndWaitForEvent(second, SocketIOEvents.ERROR, () => pick(second, 0));
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, undo);
      const following = await next(() => pick(second, 1));
      expect(following.gameState.answeredPlayers).toBeNull();
      const followingIdentity = {
        ...identity,
        scriptStep: following.gameState.scriptView!.programCounter
      };
      expect(followingIdentity.scriptStep).toBe(identity.scriptStep + 1);
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, undo);
      expect((await buzz(second, followingIdentity)).gameState.answeringPlayer).toBe(otherId);
      expect((await next(() => pick(second, 0, followingIdentity))).outcomes).toEqual([
        { playerId: otherId, answerType: "wrong", change: -100, score: 0 }
      ]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(await repo.getStats(gameId, playerId)).toMatchObject({
        questionsAnswered: "1",
        wrongAnswers: "1",
        currentScore: "-100"
      });
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
