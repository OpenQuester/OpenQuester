import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import { GameActionLockService } from "application/services/lock/GameActionLockService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  AnswerSubmittedBroadcastData,
  GameLeaveBroadcastData,
  PlayerScoreChangeBroadcastData,
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import {
  type CollectedSocketEvent,
  type EventCollector,
  finishTestCleanup,
  NO_TEST_FAILURE,
  QUEUE_BURST_SIZE,
  QUEUE_DRAIN_BUDGET_MS,
  releaseHeldGameLock
} from "tests/socket/game/utils/QueueTestHelpers";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Game Lock and Queue Mechanics", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;
  let lockService: GameActionLockService;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
    lockService = container.resolve(GameActionLockService);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Concurrent Player Leave", () => {
    it("should handle two players leaving simultaneously", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        const leaving = playerSockets.slice(0, 2);
        const accepted = leaving.map((socket) =>
          scenario
            .createAcceptedActionProbe({
              gameId: setup.gameId,
              actionType: GameActionType.LEAVE,
              socketId: socket.id
            })
            .waitForCount(1)
        );
        const leaves = scenario.collectEvents<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE,
          2
        );
        for (const socket of leaving) scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
        await Promise.all(accepted);
        const leftUserIds = (await leaves.promise).map(({ user }) => user);
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        expect(leaves.count()).toBe(2);
        expect([...leftUserIds].sort((a, b) => a - b)).toEqual(
          setup.playerUsers
            .slice(0, 2)
            .map(({ id }) => id)
            .sort((a, b) => a - b)
        );

        expect(leftUserIds).toHaveLength(2);

        // Verify both players are gone from game
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });

        // One showman + one player should remain connected (2 total)
        expect(connectedPlayers.length).toBe(2);
      }));

    it("should handle three players leaving in rapid succession", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        const accepted = playerSockets.map((socket) =>
          scenario
            .createAcceptedActionProbe({
              gameId: setup.gameId,
              actionType: GameActionType.LEAVE,
              socketId: socket.id
            })
            .waitForCount(1)
        );
        const leaves = scenario.collectEvents<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE,
          3
        );
        for (const socket of playerSockets) scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
        await Promise.all(accepted);
        const leftUserIds = (await leaves.promise).map(({ user }) => user);
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        expect(leaves.count()).toBe(3);
        expect([...leftUserIds].sort((a, b) => a - b)).toEqual(
          setup.playerUsers.map(({ id }) => id).sort((a, b) => a - b)
        );

        expect(leftUserIds).toHaveLength(3);

        // Verify only one player remains
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Only showman should remain (1 total)
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);

        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });
      }));

    it("should handle player leave during active question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick a question to enter answering phase
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        const accepted = playerSockets.map((socket) =>
          scenario
            .createAcceptedActionProbe({
              gameId: setup.gameId,
              actionType: GameActionType.LEAVE,
              socketId: socket.id
            })
            .waitForCount(1)
        );
        const leaves = scenario.collectEvents<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE,
          2
        );
        for (const socket of playerSockets) scenario.actor(socket).emit(SocketIOGameEvents.LEAVE);
        await Promise.all(accepted);
        const leftUserIds = (await leaves.promise).map(({ user }) => user);
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        expect(leaves.count()).toBe(2);
        expect([...leftUserIds].sort((a, b) => a - b)).toEqual(
          setup.playerUsers.map(({ id }) => id).sort((a, b) => a - b)
        );

        expect(leftUserIds).toHaveLength(2);

        // Verify both players left (only showman remains)
        const game = await utils.getGameFromGameService(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);
      }));
  });

  describe("Concurrent Answer Submission and Review", () => {
    it("should handle rapid player answer and showman review", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick question and wait for question data
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state before actions
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        // Setup event listeners for answer result and answer-show-start
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        const answerShowStartPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // A review requires an established answering player.
        const answerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        const answer = await answerPromise;

        // Now submit the review after the answer has been processed
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 400,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result and answer-show-start to ensure
        // the server has fully transitioned to SHOWING_ANSWER state
        // and released the lock before we send skip-show-answer
        const answerResult = await answerResultPromise;
        await answerShowStartPromise;

        // Skip show answer phase — this also waits for ANSWER_SHOW_END
        await utils.skipShowAnswer(showmanSocket);

        // Verify all events were received
        expect(answer).toBeDefined();
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(AnswerResultType.CORRECT);

        // Verify player score was updated correctly
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.players.find((p) => p.role === PlayerRole.PLAYER);
        expect(player).toBeDefined();
        expect(player!.score).toBe(400);

        // Verify question state transitioned correctly through the queue
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      }));

    it("should handle multiple rapid answer attempts (only first succeeds)", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let answerEvents: EventCollector<{ userId: number }> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          // Pick question
          const questionDataPromise = scenario.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_DATA
          );
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);
          await questionDataPromise;

          answerEvents = scenario.collectEvents<{ userId: number }>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER,
            1
          );

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.QUESTION_ANSWER
          });
          const allAccepted = probe.waitForCount(playerSockets.length);

          // All three players try to answer simultaneously
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          scenario.actor(playerSockets[2]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});

          const answers = await answerEvents.promise;
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(playerSockets.length);
          expect(
            probe
              .records()
              .map(({ socketId }) => socketId)
              .sort()
          ).toEqual(playerSockets.map(({ id }) => id).sort());

          // Only one answer should be accepted
          expect(answerEvents.count()).toBe(1);

          // Verify game state shows correct answering player
          const gameState = await utils.getGameState(gameId);
          expect(gameState!.answeringPlayer).toBe(answers[0].userId);
          expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [answerEvents ?? undefined]);
        }
      }));

    it("should drain repeated answer-submitted clicks in FIFO order for all clients", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId } = setup;

        let showmanSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let otherPlayerSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let spectatorSubmittedEvents: EventCollector<AnswerSubmittedBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const answerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          await answerPromise;

          const answerTexts = Array.from(
            { length: QUEUE_BURST_SIZE },
            (_, index) => `Queued answer ${index + 1}`
          );
          const expectedEvents = answerTexts.map((answerText) => ({ answerText }));

          showmanSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );
          otherPlayerSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            playerSockets[1],
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );
          spectatorSubmittedEvents = scenario.collectEvents<AnswerSubmittedBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.ANSWER_SUBMITTED,
            QUEUE_BURST_SIZE
          );

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.ANSWER_SUBMITTED
          });
          const allAccepted = probe.waitForCount(answerTexts.length);

          for (const answerText of answerTexts) {
            scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
              answerText
            });
          }

          const [showmanEvents, otherPlayerEvents, spectatorEvents] = await Promise.all([
            showmanSubmittedEvents.promise,
            otherPlayerSubmittedEvents.promise,
            spectatorSubmittedEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(answerTexts.length);

          expect(showmanEvents).toEqual(expectedEvents);
          expect(otherPlayerEvents).toEqual(expectedEvents);
          expect(spectatorEvents).toEqual(expectedEvents);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [
            showmanSubmittedEvents ?? undefined,
            otherPlayerSubmittedEvents ?? undefined,
            spectatorSubmittedEvents ?? undefined
          ]);
        }
      }));

    it("should apply only the first answer review from a rapid duplicate burst", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        let answerResultEvents: EventCollector<QuestionAnswerResultEventPayload> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const answerPromise = scenario.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER
          );
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
          await answerPromise;

          answerResultEvents = scenario.collectEvents<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            1
          );

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.ANSWER_RESULT
          });
          const allAccepted = probe.waitForCount(QUEUE_BURST_SIZE);

          for (let index = 0; index < QUEUE_BURST_SIZE; index += 1) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
              scoreResult: -400,
              answerType: AnswerResultType.WRONG
            });
          }

          const [answerResult] = await answerResultEvents.promise;
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(QUEUE_BURST_SIZE);

          expect(answerResultEvents.count()).toBe(1);
          expect(answerResult.answerResult.player).toBe(playerUsers[0].id);
          expect(answerResult.answerResult.result).toBe(-400);
          expect(answerResult.answerResult.score).toBe(-400);
          expect(answerResult.answerResult.answerType).toBe(AnswerResultType.WRONG);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.answeringPlayer).toBeNull();

          const game = await utils.getGameFromGameService(gameId);
          const reviewedPlayer = game.players.find(
            (player) => player.meta.id === playerUsers[0].id
          );
          expect(reviewedPlayer!.score).toBe(-400);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [answerResultEvents ?? undefined]);
        }
      }));

    it("should handle answer submission during concurrent player leave", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Pick question
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        const beforeCommands = scenario.mark();
        const answerAccepted = scenario
          .createAcceptedActionProbe({
            gameId: setup.gameId,
            actionType: GameActionType.QUESTION_ANSWER,
            socketId: playerSockets[0].id
          })
          .waitForCount(1);
        const leaveAccepted = scenario
          .createAcceptedActionProbe({
            gameId: setup.gameId,
            actionType: GameActionType.LEAVE,
            socketId: playerSockets[1].id
          })
          .waitForCount(1);
        const answerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.LEAVE);
        const [answerData, leaveData] = await Promise.all([
          answerPromise,
          leavePromise,
          answerAccepted,
          leaveAccepted
        ]);
        await scenario.assert.waitForActionsComplete({ gameId: setup.gameId });
        expect(answerData.userId).toBe(setup.playerUsers[0].id);
        expect(leaveData.user).toBe(setup.playerUsers[1].id);
        for (const event of [SocketIOGameEvents.QUESTION_ANSWER, SocketIOGameEvents.LEAVE]) {
          scenario.assert.expectDirectedEventCount({
            actor: scenario.actor(showmanSocket),
            direction: "inbound",
            event,
            afterSequence: beforeCommands,
            expectedCount: 1
          });
        }

        expect(answerData).toBeDefined();
        expect(leaveData).toBeDefined();

        // Verify game state is consistent
        const game = await utils.getGameFromGameService(setup.gameId);
        const gameState = await utils.getGameState(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Showman + one remaining player = 2 (player 1 left)
        expect(connectedPlayers.length).toBe(2);

        // The answer from player 0 should have been processed (state: ANSWERING)
        expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState!.answeringPlayer).toBe(answerData.userId);
      }));
  });

  describe("Concurrent Question Skips", () => {
    it("should drain a full-player skip burst and auto-finish the question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId } = setup;

        let showmanSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let playerSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let spectatorSkipEvents: EventCollector<QuestionSkipBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const expectedPlayerIds = setup.playerUsers.map((user) => user.id);
          const expectedSortedPlayerIds = [...expectedPlayerIds].sort((a, b) => a - b);
          const sortedSkippedPlayerIds = (events: QuestionSkipBroadcastData[]): number[] =>
            events.map((event) => event.playerId).sort((a, b) => a - b);

          showmanSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          playerSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          spectatorSkipEvents = scenario.collectEvents<QuestionSkipBroadcastData>(
            spectatorSockets[0],
            SocketIOGameEvents.QUESTION_SKIP,
            playerSockets.length
          );
          const questionFinishPromise = scenario.waitForEvent<QuestionFinishEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_FINISH
          );

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.QUESTION_SKIP
          });
          const allAccepted = probe.waitForCount(playerSockets.length);

          for (const playerSocket of playerSockets) {
            scenario.actor(playerSocket).emit(SocketIOGameEvents.QUESTION_SKIP, {});
          }

          const [showmanSkips, playerSkips, spectatorSkips, questionFinish] = await Promise.all([
            showmanSkipEvents.promise,
            playerSkipEvents.promise,
            spectatorSkipEvents.promise,
            questionFinishPromise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(playerSockets.length);
          expect(
            probe
              .records()
              .map(({ socketId }) => socketId)
              .sort()
          ).toEqual(playerSockets.map(({ id }) => id).sort());

          expect(sortedSkippedPlayerIds(showmanSkips)).toEqual(expectedSortedPlayerIds);
          expect(sortedSkippedPlayerIds(playerSkips)).toEqual(expectedSortedPlayerIds);
          expect(sortedSkippedPlayerIds(spectatorSkips)).toEqual(expectedSortedPlayerIds);
          expect(questionFinish.answerText).toBeDefined();

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(gameState!.skippedPlayers).toBeNull();
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [
            showmanSkipEvents ?? undefined,
            playerSkipEvents ?? undefined,
            spectatorSkipEvents ?? undefined
          ]);
        }
      }));

    it("should drain queued skip/unskip toggles in FIFO order without finishing question", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1);
        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setup;

        let showmanSkipEvents: EventCollector<
          CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
        > | null = null;
        let spectatorSkipEvents: EventCollector<
          CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
        > | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);

          const player0SkipAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.QUESTION_SKIP,
            playerId: playerUsers[0].id
          };
          const player0UnskipAction = {
            socket: playerSockets[0],
            event: SocketIOGameEvents.QUESTION_UNSKIP,
            playerId: playerUsers[0].id
          };
          const player1SkipAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.QUESTION_SKIP,
            playerId: playerUsers[1].id
          };
          const player1UnskipAction = {
            socket: playerSockets[1],
            event: SocketIOGameEvents.QUESTION_UNSKIP,
            playerId: playerUsers[1].id
          };
          const skipToggleSequence = [
            player0SkipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player1UnskipAction,
            player0SkipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction,
            player1UnskipAction,
            player1SkipAction,
            player0UnskipAction,
            player0SkipAction
          ];
          const queuedSkipToggleActions = skipToggleSequence.slice(0, -1);
          const drainTriggerAction = skipToggleSequence[skipToggleSequence.length - 1];
          const skipEvents = [SocketIOGameEvents.QUESTION_SKIP, SocketIOGameEvents.QUESTION_UNSKIP];

          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;

          const probe = scenario.createAcceptedActionProbe({ gameId });
          const allAccepted = probe.waitForCount(skipToggleSequence.length);

          let queuedSkipToggleCount = 0;
          for (const action of queuedSkipToggleActions) {
            scenario.actor(action.socket).emit(action.event);
            queuedSkipToggleCount += 1;
            await utils.waitForQueueLengthAtLeast(gameId, queuedSkipToggleCount);
          }

          showmanSkipEvents = scenario.collectSocketEvents<
            QuestionSkipBroadcastData | QuestionUnskipBroadcastData
          >(showmanSocket, skipEvents, skipToggleSequence.length);
          spectatorSkipEvents = scenario.collectSocketEvents<
            QuestionSkipBroadcastData | QuestionUnskipBroadcastData
          >(spectatorSockets[0], skipEvents, skipToggleSequence.length);

          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);

          const startedAt = Date.now();
          scenario.actor(drainTriggerAction.socket).emit(drainTriggerAction.event);

          const [showmanEvents, spectatorEvents] = await Promise.all([
            showmanSkipEvents.promise,
            spectatorSkipEvents.promise
          ]);
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(skipToggleSequence.length);
          expect(
            probe.records().map(({ actionType, playerId }) => ({ actionType, playerId }))
          ).toEqual(
            skipToggleSequence.map(({ event, playerId }) => ({
              actionType:
                event === SocketIOGameEvents.QUESTION_SKIP
                  ? GameActionType.QUESTION_SKIP
                  : GameActionType.QUESTION_UNSKIP,
              playerId
            }))
          );
          const durationMs = Date.now() - startedAt;

          const expectedEventOrder = skipToggleSequence.map((action) => ({
            event: action.event,
            playerId: action.playerId
          }));
          const eventOrder = (
            events: Array<
              CollectedSocketEvent<QuestionSkipBroadcastData | QuestionUnskipBroadcastData>
            >
          ) =>
            events.map(({ event, data }) => ({
              event,
              playerId: data.playerId
            }));

          expect(eventOrder(showmanEvents)).toEqual(expectedEventOrder);
          expect(eventOrder(spectatorEvents)).toEqual(expectedEventOrder);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          const gameState = await utils.getGameState(gameId);
          expect(gameState!.questionState).toBe(QuestionState.SHOWING);
          expect(gameState!.skippedPlayers).toHaveLength(2);
          expect(gameState!.skippedPlayers).toEqual(
            expect.arrayContaining([playerUsers[0].id, playerUsers[1].id])
          );
          expect(gameState!.skippedPlayers).not.toContain(playerUsers[2].id);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(
            primaryFailure,
            [showmanSkipEvents ?? undefined, spectatorSkipEvents ?? undefined],
            async () => {
              lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
            }
          );
        }
      }));
  });

  describe("Concurrent Kick and Leave", () => {
    it("should handle player leaving while being kicked", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let leaveEvents: EventCollector<GameLeaveBroadcastData> | null = null;
        let lockToken = "";
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const targetPlayerId = setup.playerUsers[0].id;
          const recipients = [showmanSocket, ...playerSockets].map((socket) =>
            scenario.actor(socket)
          );
          const beforeCommands = scenario.mark();
          const leaveProbe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.LEAVE,
            socketId: playerSockets[0].id
          });
          const kickProbe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_KICK,
            socketId: showmanSocket.id
          });
          const leaveAccepted = leaveProbe.waitForCount(1);
          const kickAccepted = kickProbe.waitForCount(1);
          const kickError = scenario.waitForEvent(showmanSocket, SocketIOEvents.ERROR);

          leaveEvents = scenario.collectEvents<GameLeaveBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.LEAVE,
            1
          );

          // Enqueue LEAVE first. Release does not drain: the real KICK is the trigger.
          const lock = await lockService.acquireLock(gameId);
          expect(lock.acquired).toBe(true);
          lockToken = lock.token;
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
          await leaveAccepted;
          lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_KICKED, {
            playerId: targetPlayerId
          });

          const [leaves, error] = await Promise.all([leaveEvents.promise, kickError, kickAccepted]);
          await utils.waitForActionsComplete(gameId);
          expect(leaves.map(({ user }) => user)).toEqual([targetPlayerId]);
          expect(error.message).toBe("Player not found"); // PLAYER_NOT_FOUND after the queued LEAVE.
          expect(leaveProbe.records()).toHaveLength(1);
          expect(kickProbe.records()).toHaveLength(1);
          await scenario.assert.noInboundMany({
            actors: recipients,
            event: SocketIOGameEvents.PLAYER_KICKED,
            afterSequence: beforeCommands,
            durationMs: 100
          });

          // Only one leave event should be received
          expect(leaveEvents.count()).toBe(1);

          // Verify player is gone
          const kickedGame = await utils.getGameFromGameService(gameId);
          const connectedPlayers = kickedGame.players.filter(
            (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
          );

          // Should have showman + 1 remaining player = 2
          expect(connectedPlayers.length).toBe(2);

          const playerIds = connectedPlayers.map((p) => p.meta.id);
          expect(playerIds).not.toContain(targetPlayerId);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [leaveEvents ?? undefined], async () => {
            lockToken = await releaseHeldGameLock(lockService, gameId, lockToken);
          });
        }
      }));
  });

  describe("Sequential Game Pause and Actions", () => {
    it("should allow question selection after pause and unpause", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);

        // Verify we're in CHOOSING state
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);

        // Pause and unpause must complete before question selection.
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});

        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.isPaused).toBe(true);

        // Unpause
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // Now picking should work
        const questionDataPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.currentQuestion).toBeDefined();
      }));
  });

  describe("Concurrent Score Changes", () => {
    it("should drain a burst of score changes in FIFO order within the queue budget", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        let scoreEvents: EventCollector<PlayerScoreChangeBroadcastData> | null = null;
        let primaryFailure: unknown = NO_TEST_FAILURE;

        try {
          await utils.startGame(showmanSocket);

          const game = await utils.getGameFromGameService(gameId);
          const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
          const scores = Array.from(
            { length: QUEUE_BURST_SIZE },
            (_, index) => player.score + (index + 1) * 10
          );

          scoreEvents = scenario.collectEvents<PlayerScoreChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.SCORE_CHANGED,
            QUEUE_BURST_SIZE
          );

          const probe = scenario.createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.PLAYER_SCORE_CHANGE
          });
          const allAccepted = probe.waitForCount(scores.length);

          const startedAt = Date.now();
          for (const newScore of scores) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
              playerId: player.meta.id,
              newScore
            });
          }

          const receivedScores = await scoreEvents.promise;
          await allAccepted;
          await utils.waitForActionsComplete(gameId);
          expect(probe.records()).toHaveLength(scores.length);
          const durationMs = Date.now() - startedAt;

          expect(receivedScores.map((event) => event.newScore)).toEqual(scores);
          expect(durationMs).toBeLessThanOrEqual(QUEUE_DRAIN_BUDGET_MS);

          // Verify final score is the last value
          const scoreGame = await utils.getGameFromGameService(gameId);
          const finalPlayer = scoreGame.players.find((p) => p.meta.id === player.meta.id)!;
          expect(finalPlayer.score).toBe(scores[scores.length - 1]);
        } catch (error) {
          primaryFailure = error;
        } finally {
          await finishTestCleanup(primaryFailure, [scoreEvents ?? undefined]);
        }
      }));
  });
});
