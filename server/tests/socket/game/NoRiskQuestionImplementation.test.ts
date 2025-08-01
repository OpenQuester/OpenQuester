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

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("NoRisk Question Implementation", () => {
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
    await cleanup?.();
    await testEnv.teardown();
    await RedisConfig.disconnect();
  });

  describe("NoRisk question prevents score loss on wrong answers", () => {
    it("should not decrease player score when answering NoRisk question incorrectly", async () => {
      // Setup game with 1 player
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const gameState = await utils.getGameState(gameId);
        const noRiskQuestion = await utils.findQuestionByType(
          gameState!,
          PackageQuestionType.NO_RISK,
          gameId
        );

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Get player's initial score (should be 0)
        const playerId = setup.playerUsers[0].id;
        await utils.setPlayerScore(gameId, playerId, 0);
        const initialScore = 0;

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as WRONG (negative score for NoRisk should not decrease score)
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -400, // Negative score (wrong answer)
          answerType: AnswerResultType.WRONG,
        });

        // Wait for answer result to be processed
        await answerResultPromise;

        // Get the game state to check final player score
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // With NoRisk, score should not decrease even with wrong answer
        expect(finalScore).toBeGreaterThanOrEqual(initialScore);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow player to gain score on correct NoRisk question answers", async () => {
      // Setup game with 1 player
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const gameState = await utils.getGameState(gameId);
        const noRiskQuestion = await utils.findQuestionByType(
          gameState!,
          PackageQuestionType.NO_RISK,
          gameId
        );

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Set initial score
        const playerId = setup.playerUsers[0].id;
        await utils.setPlayerScore(gameId, playerId, 0);
        const initialScore = 0;

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as CORRECT (positive score for NoRisk should work normally)
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 800, // Positive score (correct answer, NoRisk has priceMultiplier: 2)
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for answer result to be processed
        await answerResultPromise;

        // Get final score - NoRisk questions should still allow score gains
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // Should be able to gain points for correct answers
        expect(finalScore).toBe(initialScore + 800); // Should gain the full score for correct answer
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle skip answers for NoRisk questions appropriately", async () => {
      // Setup game with 1 player
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const gameState = await utils.getGameState(gameId);
        const noRiskQuestion = await utils.findQuestionByType(
          gameState!,
          PackageQuestionType.NO_RISK,
          gameId
        );

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Set initial score
        const playerId = setup.playerUsers[0].id;
        await utils.setPlayerScore(gameId, playerId, 0);
        const initialScore = 0;

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as SKIP (score should remain unchanged)
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 0, // Zero score (skip)
          answerType: AnswerResultType.SKIP,
        });

        // Wait for answer result to be processed
        await answerResultPromise;

        // Verify score remains unchanged after skip
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // Skip should not affect score regardless of question type
        expect(finalScore).toBe(initialScore);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
