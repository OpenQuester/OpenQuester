import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * Edge case tests for question answer scenarios:
 * - Wrong answer when all players have skipped (auto-skip optimization)
 * - Picking non-existent question
 *
 * Note: Other edge cases are covered in:
 * - PlayerLeaveStateCleanup.test.ts (answering player disconnect/leave)
 * - SocketIOQuestionFlow.test.ts (picking already played question)
 */
describe("Question Answer Edge Cases", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Player Disconnect During SHOWING State", () => {
    it("should allow showman to process answer even after player disconnected (if not already processed)", async () => {
      // This test verifies the fix for fetchDisconnected: true
      // We need to test when player disconnects AFTER they are no longer answering
      // (e.g., during SHOWING phase after they got a wrong answer)
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for answer result
        const answerResultPromise =
          utils.waitForEvent<QuestionAnswerResultEventPayload>(
            playerSockets[1],
            SocketIOGameEvents.ANSWER_RESULT,
            3000
          );

        // Showman sends wrong answer result first (before disconnect)
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });

        await answerResultPromise;

        // Now player 0 disconnects (while in SHOWING state, not answering)
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE,
          3000
        );
        playerSockets[0].disconnect();
        await leavePromise;

        // Verify player is disconnected
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerUsers[0].id, {
          fetchDisconnected: true,
        });
        expect(player?.gameStatus).toBe(PlayerGameStatus.DISCONNECTED);
        // Verify their score was updated (penalty applied)
        expect(player!.score).toBeLessThan(0);
      } finally {
        setup.playerSockets = [playerSockets[1]];
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Wrong Answer When All Players Skipped", () => {
    it("should auto-skip question when wrong answer given and all other players skipped", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Players 2 and 3 skip the question
        await new Promise<void>((resolve) => {
          showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
          playerSockets[1].emit(SocketIOGameEvents.QUESTION_SKIP, {});
        });
        await new Promise<void>((resolve) => {
          showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
          playerSockets[2].emit(SocketIOGameEvents.QUESTION_SKIP, {});
        });

        // Verify 2 players have skipped
        const stateAfterSkips = await utils.getGameState(gameId);
        expect(stateAfterSkips!.skippedPlayers).toHaveLength(2);
        expect(stateAfterSkips!.skippedPlayers).toContain(playerUsers[1].id);
        expect(stateAfterSkips!.skippedPlayers).toContain(playerUsers[2].id);

        // Player 1 answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify player 1 is answering
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);

        // Set up listeners for answer result AND question finish
        const answerResultPromise =
          utils.waitForEvent<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            3000
          );
        const questionFinishPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH,
          3000
        );

        // Showman sends wrong answer result
        // Since all other players have skipped, question should auto-skip
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });

        // Verify answer result and question finish were both received
        const answerResult = await answerResultPromise;
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(
          AnswerResultType.WRONG
        );
        // Timer should be null since question auto-skipped
        expect(answerResult.timer).toBeNull();

        const questionFinish = await questionFinishPromise;
        expect(questionFinish).toBeDefined();

        // Verify game went directly to CHOOSING state (skipped SHOWING)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.timer).toBeNull();
        expect(finalState!.answeringPlayer).toBeNull();
        // Skipped players should be cleared after question finish
        expect(finalState!.skippedPlayers).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should transition to SHOWING state when wrong answer given but players can still answer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Only Player 2 skips (Player 3 can still answer)
        await new Promise<void>((resolve) => {
          showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
          playerSockets[1].emit(SocketIOGameEvents.QUESTION_SKIP, {});
        });

        // Verify 1 player has skipped
        const stateAfterSkip = await utils.getGameState(gameId);
        expect(stateAfterSkip!.skippedPlayers).toHaveLength(1);
        expect(stateAfterSkip!.skippedPlayers).toContain(playerUsers[1].id);

        // Player 1 answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for answer result
        const answerResultPromise =
          utils.waitForEvent<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            3000
          );

        // Showman sends wrong answer result
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });

        // Verify answer result received with timer (normal SHOWING transition)
        const answerResult = await answerResultPromise;
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(
          AnswerResultType.WRONG
        );
        // Timer should be set since Player 3 can still answer
        expect(answerResult.timer).toBeDefined();

        // Verify game went to SHOWING state (normal flow)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
        expect(finalState!.timer).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should auto-skip when last answering player gets wrong and they were the only non-skipped", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 2 skips
        await new Promise<void>((resolve) => {
          showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
          playerSockets[1].emit(SocketIOGameEvents.QUESTION_SKIP, {});
        });

        // Verify Player 2 skipped
        const stateAfterSkip = await utils.getGameState(gameId);
        expect(stateAfterSkip!.skippedPlayers).toContain(playerUsers[1].id);

        // Player 1 answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listeners
        const answerResultPromise =
          utils.waitForEvent<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            3000
          );
        const questionFinishPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH,
          3000
        );

        // Showman sends wrong answer - should auto-skip since Player 2 already skipped
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });

        // Both events should be received
        const answerResult = await answerResultPromise;
        expect(answerResult.timer).toBeNull();

        await questionFinishPromise;

        // Should be in CHOOSING state, not SHOWING
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Question Pick Validation", () => {
    it("should reject picking non-existent question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Try to pick a non-existent question
        const nonExistentQuestionId = 999999;

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout - expected error event"));
          }, 5000);

          showmanSocket.on(SocketIOEvents.ERROR, (error: unknown) => {
            clearTimeout(timeout);
            const errorObj = error as { message?: string };
            expect(errorObj.message?.toLowerCase()).toContain("not found");
            resolve();
          });

          showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: nonExistentQuestionId,
          });
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
