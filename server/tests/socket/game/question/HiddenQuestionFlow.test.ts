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

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Hidden Question Flow Tests", () => {
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
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    await redisClient.del(...(await redisClient.keys("*")));

    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Hidden Question Behavior", () => {
    it("should hide price in game state but reveal it when picked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Get initial game state and verify hidden question has null price
        const initialGameState = await utils.getGameState(gameId);
        expect(initialGameState).toBeDefined();

        // Find a hidden question in the themes
        const hiddenQuestion = await utils.findQuestionByType(
          initialGameState!,
          PackageQuestionType.HIDDEN,
          gameId
        );

        expect(hiddenQuestion).toBeDefined();
        expect(hiddenQuestion!.price).toBeNull(); // Price should be hidden in game state

        // Get the actual question ID to pick
        const hiddenQuestionId = hiddenQuestion!.id;

        // Pick the hidden question
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout waiting for QUESTION_DATA"));
          }, 2000);

          playerSocket.on(
            SocketIOGameEvents.QUESTION_DATA,
            (data: GameQuestionDataEventPayload) => {
              clearTimeout(timeout);
              try {
                // Verify that the question data now reveals the actual price
                expect(data.data).toBeDefined();
                expect(data.data.price).toBeDefined();
                expect(data.data.price).not.toBeNull();
                expect(typeof data.data.price).toBe("number");
                expect(data.data.price).toBeGreaterThan(0);

                // Verify this is indeed a hidden question
                expect(data.data.type).toBe(PackageQuestionType.HIDDEN);
                expect(data.data.isHidden).toBe(true);
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );

          showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: hiddenQuestionId,
          });
        });

        // Verify game state shows we're now showing the question
        const showingGameState = await utils.getGameState(gameId);
        expect(showingGameState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingGameState!.currentQuestion).toBeDefined();
        expect(showingGameState!.currentQuestion!.price).toBeDefined();
        expect(showingGameState!.currentQuestion!.price).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle hidden question answer flow normally after revealing price", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find and pick a hidden question using the helper method
        const hiddenQuestionId = await utils.getFirstHiddenQuestionId(gameId);
        await utils.pickQuestion(showmanSocket, hiddenQuestionId);

        // Verify we can answer the hidden question normally
        await utils.answerQuestion(playerSocket, showmanSocket);

        // Set up event listener for answer result AND question finish before emitting
        const answerResultPromise = utils.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          1000
        );

        const questionFinishPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for QUESTION_FINISH"));
          }, 2000);

          playerSocket.once(SocketIOGameEvents.QUESTION_FINISH, (_data) => {
            clearTimeout(timeout);
            resolve();
          });
        });

        // Submit answer result from showman
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for both events
        await answerResultPromise;
        await questionFinishPromise;

        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should show hidden question data to both showman and players when picked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find a hidden question
        const hiddenQuestionId = await utils.getFirstHiddenQuestionId(gameId);

        // Set up promises to capture data sent to both showman and player
        const showmanDataPromise = new Promise<GameQuestionDataEventPayload>(
          (resolve) => {
            showmanSocket.once(SocketIOGameEvents.QUESTION_DATA, resolve);
          }
        );
        const playerDataPromise = new Promise<GameQuestionDataEventPayload>(
          (resolve) => {
            playerSocket.once(SocketIOGameEvents.QUESTION_DATA, resolve);
          }
        );

        // Pick the hidden question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: hiddenQuestionId,
        });

        const [showmanData, playerData] = await Promise.all([
          showmanDataPromise,
          playerDataPromise,
        ]);

        // Both should receive question data with revealed price
        expect(showmanData.data.price).toBeDefined();
        expect(showmanData.data.price).not.toBeNull();
        expect(playerData.data.price).toBeDefined();
        expect(playerData.data.price).not.toBeNull();

        // Prices should be the same
        expect(showmanData.data.price).toBe(playerData.data.price);

        // Both should recognize it as a hidden question
        expect(showmanData.data.type).toBe(PackageQuestionType.HIDDEN);
        expect(showmanData.data.isHidden).toBe(true);
        expect(playerData.data.type).toBe(PackageQuestionType.HIDDEN);
        expect(playerData.data.isHidden).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Multiple Hidden Questions", () => {
    it("should handle multiple hidden questions independently", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        const initialGameState = await utils.getGameState(gameId);

        // Find all hidden questions
        const hiddenQuestions = utils.findAllQuestionsByType(
          initialGameState!,
          PackageQuestionType.HIDDEN
        );

        if (hiddenQuestions.length < 2) {
          console.warn(
            "Test skipped: Not enough hidden questions in test package"
          );
          expect(false).toBe(true);
          return;
        }

        // Verify all hidden questions have null prices initially
        for (const hiddenQ of hiddenQuestions) {
          expect(hiddenQ.price).toBeNull();
        }

        // Pick first hidden question and verify price is revealed
        await utils.pickQuestion(showmanSocket, hiddenQuestions[0].id);

        // Complete the first question
        await utils.answerQuestion(playerSocket, showmanSocket);
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });
        await utils.waitForEvent(
          playerSocket,
          SocketIOGameEvents.QUESTION_FINISH
        );

        // Verify we're back to choosing state
        const afterFirstState = await utils.getGameState(gameId);
        expect(afterFirstState!.questionState).toBe(QuestionState.CHOOSING);

        // Check that remaining hidden questions still have null price in game state
        const remainingHiddenQuestions = utils.findAllQuestionsByType(
          afterFirstState!,
          PackageQuestionType.HIDDEN
        );

        const unplayedHiddenQuestion = remainingHiddenQuestions.find(
          (q) => !q.isPlayed
        );
        if (unplayedHiddenQuestion) {
          expect(unplayedHiddenQuestion.price).toBeNull();
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
