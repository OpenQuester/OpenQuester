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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Auto-Skip Question Flow Tests", () => {
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

  describe("Secret Question Auto-Skip", () => {
    it("should skip secret question transfer phase when only showman is in game", async () => {
      // Setup game with only showman (0 players, 0 spectators)
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Find a secret question
        const gameState = await utils.getGameState(gameId);
        const secretQuestion = await utils.findQuestionByType(
          gameState!,
          PackageQuestionType.SECRET,
          gameId
        );

        expect(secretQuestion).toBeDefined();
        expect(secretQuestion!.id).toBeGreaterThan(0);

        // Set up listener for question data (which should come immediately when auto-skipping)
        const questionDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA,
            5000
          );

        // Pick the secret question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });

        const questionData = await questionDataPromise;

        // Verify we got the question data directly (skipped transfer phase)
        expect(questionData.data.id).toBe(secretQuestion!.id);
        expect(questionData.data.type).toBe(PackageQuestionType.SECRET);

        // Verify the game state shows SHOWING (not SECRET_TRANSFER)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
        expect(finalState!.secretQuestionData).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Stake Question Auto-Skip", () => {
    it("should skip stake question bidding phase when only showman is in game", async () => {
      // Setup game with only showman (0 players, 0 spectators)
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Find a stake question
        const gameState = await utils.getGameState(gameId);
        const stakeQuestion = await utils.findQuestionByType(
          gameState!,
          PackageQuestionType.STAKE,
          gameId
        );

        expect(stakeQuestion).toBeDefined();
        expect(stakeQuestion!.id).toBeGreaterThan(0);

        // Set up listener for question data (which should come immediately when auto-skipping)
        const questionDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA,
            5000
          );

        // Pick the stake question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestion!.id,
        });

        const questionData = await questionDataPromise;

        // Verify we got the question data directly (skipped bidding phase)
        expect(questionData.data.id).toBe(stakeQuestion!.id);
        expect(questionData.data.type).toBe(PackageQuestionType.STAKE);

        // Verify the game state shows SHOWING (not BIDDING)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
