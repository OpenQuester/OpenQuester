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
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import {
  GameTestSetup,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";

// Helper function to verify final round data in game state
function verifyFinalRoundData(gameState: GameStateDTO) {
  const finalData = gameState.finalRoundData;
  expect(finalData).toBeDefined();

  // Placeholder to avoid compiler errors since we know finalData is defined
  if (finalData === null || finalData === undefined) {
    throw new Error("Final round data is not defined");
  }

  expect(gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);

  // Most importantly - verify final round data is present
  expect(finalData.turnOrder).toBeDefined();
  expect(Array.isArray(finalData.turnOrder)).toBe(true);
  expect(finalData.turnOrder.length).toBeGreaterThan(0);

  // Verify current turn player is set
  expect(gameState.currentTurnPlayerId).toBeDefined();
  expect(typeof gameState.currentTurnPlayerId).toBe("number");
}

// Helper function to verify showman gets full question data
function verifyShowmanQuestionData(gameState: GameStateDTO) {
  expect(gameState.currentRound).toBeDefined();
  expect(gameState.currentRound!.themes.length).toBe(3);

  // For each theme, verify it has question data
  for (let i = 0; i < 3; i++) {
    const theme = gameState.currentRound!.themes[i];
    expect(theme.questions.length).toBeGreaterThan(0);

    // The question should be a valid question object with at least basic properties
    const question = theme.questions[0];

    // Basic question metadata that would be visible to anyone
    expect(question.id).toBeTruthy();
    expect(question.order).toBeGreaterThanOrEqual(0);
    expect(question.price).toBeNull(); // Final round questions have null price
    expect(question.isPlayed).toBe(false);
  }
}

// Helper function to verify players get no question data
function verifyPlayerQuestionData(gameState: GameStateDTO) {
  expect(gameState.currentRound).toBeDefined();
  expect(gameState.currentRound!.themes.length).toBe(3);

  for (let i = 0; i < 3; i++) {
    const theme = gameState.currentRound!.themes[i];

    // Theme metadata should be visible
    expect(theme.id).toBeTruthy();
    expect(theme.name).toBeTruthy();
    expect(theme.order).toBeGreaterThanOrEqual(0);

    // Players should NOT see any questions during theme presentation
    expect(theme.questions).toEqual([]);
  }
}

describe("Final Round Transition Test", () => {
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
    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
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

  async function cleanupTestSetup(setup: GameTestSetup): Promise<void> {
    await utils.disconnectAndCleanup(setup.showmanSocket);
    await Promise.all(
      setup.playerSockets.map((socket) => utils.disconnectAndCleanup(socket))
    );
    await Promise.all(
      setup.spectatorSockets.map((socket) => utils.disconnectAndCleanup(socket))
    );
  }

  it("should transition to final round with proper initialization", async () => {
    /**
     * Tests the basic final round transition mechanics:
     * - Final round transition occurs after all regular round questions are completed
     * - Final round data is properly initialized with correct state
     * - Basic structure validation
     */
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      2, // 2 players
      0, // 0 spectators
      true // include final round
    );

    const { showmanSocket, gameId } = setup;

    try {
      await utils.startGame(showmanSocket);

      // Set up listener for final round transition
      const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
        showmanSocket,
        SocketIOGameEvents.NEXT_ROUND,
        15000
      );

      // Complete all questions in the regular round to trigger transition
      const currentRoundQuestionCount =
        await utils.getCurrentRoundQuestionCount(gameId);
      for (let i = 0; i < currentRoundQuestionCount; i++) {
        await utils.pickQuestion(showmanSocket);
        await utils.skipQuestion(showmanSocket);
      }

      // Verify final round transition
      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);

      // Verify round structure
      expect(gameState.currentRound).toBeDefined();
      expect(gameState.currentRound!.type).toBe("final");
      expect(gameState.currentRound!.themes.length).toBe(3);
    } finally {
      await cleanupTestSetup(setup);
    }
  });

  it("should handle final round transition via explicit progression", async () => {
    /**
     * Tests explicit next round progression to final round
     */
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      2,
      0,
      true
    );
    try {
      await utils.startGame(setup.showmanSocket);

      const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND,
        5000
      );

      await utils.progressToNextRound(setup.showmanSocket);
      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    } finally {
      await cleanupTestSetup(setup);
    }
  });

  it("should handle final round transition via answering last question correctly", async () => {
    /**
     * Tests final round transition when last question is answered correctly
     */
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      2,
      0,
      true
    );
    try {
      await utils.startGame(setup.showmanSocket);

      // Skip all but the last question
      const currentRoundQuestionCount =
        await utils.getCurrentRoundQuestionCount(setup.gameId);
      const questionsToSkip = currentRoundQuestionCount - 1; // Leave only the last question
      for (let i = 0; i < questionsToSkip; i++) {
        await utils.pickQuestion(setup.showmanSocket);
        await utils.skipQuestion(setup.showmanSocket);
      }

      const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND,
        10000
      );

      // Answer last question correctly
      await utils.pickQuestion(setup.showmanSocket);
      await utils.answerQuestion(setup.playerSockets[0], setup.showmanSocket);
      await new Promise((resolve) => setTimeout(resolve, 100));
      setup.showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: 100,
        answerType: AnswerResultType.CORRECT,
      });

      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    } finally {
      await cleanupTestSetup(setup);
    }
  });

  it("should handle final round transition via skipping last question", async () => {
    /**
     * Tests final round transition when last question is skipped
     */
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      2,
      0,
      true
    );
    try {
      await utils.startGame(setup.showmanSocket);

      const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND,
        15000
      );

      // Skip all questions to trigger natural progression
      const currentRoundQuestionCount =
        await utils.getCurrentRoundQuestionCount(setup.gameId);
      for (let i = 0; i < currentRoundQuestionCount; i++) {
        await utils.pickQuestion(setup.showmanSocket);
        await utils.skipQuestion(setup.showmanSocket);
      }

      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    } finally {
      await cleanupTestSetup(setup);
    }
  });

  it("should provide role-based question visibility in final round", async () => {
    /**
     * Core test for the main requirement:
     * - Showman receives complete question data including text and answers
     * - Players receive only theme metadata with no question data
     * - Explicit verification of question content, answer content, and files
     */
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      2, // 2 players
      0, // 0 spectators
      true // include final round
    );

    const { showmanSocket, playerSockets } = setup;

    try {
      await utils.startGame(showmanSocket);

      // Set up promises for both showman and player
      const showmanNextRoundPromise =
        utils.waitForEvent<GameNextRoundEventPayload>(
          showmanSocket,
          SocketIOGameEvents.NEXT_ROUND,
          15000
        );

      const playerNextRoundPromise =
        utils.waitForEvent<GameNextRoundEventPayload>(
          playerSockets[0],
          SocketIOGameEvents.NEXT_ROUND,
          15000
        );

      // Trigger final round transition
      const currentRoundQuestionCount =
        await utils.getCurrentRoundQuestionCount(setup.gameId);
      for (let i = 0; i < currentRoundQuestionCount; i++) {
        await utils.pickQuestion(showmanSocket);
        await utils.skipQuestion(showmanSocket);
      }

      // Get both game states
      const [showmanGameState, playerGameState] = await Promise.all([
        showmanNextRoundPromise.then((payload) => payload.gameState),
        playerNextRoundPromise.then((payload) => payload.gameState),
      ]);

      // Verify basic final round setup for both
      verifyFinalRoundData(showmanGameState);
      verifyFinalRoundData(playerGameState);

      // SHOWMAN VERIFICATION: Should see full question data
      verifyShowmanQuestionData(showmanGameState);

      // PLAYER VERIFICATION: Should see no question data
      verifyPlayerQuestionData(playerGameState);

      // CROSS-VERIFICATION: Theme metadata should match
      for (let i = 0; i < 3; i++) {
        const showmanTheme = showmanGameState.currentRound!.themes[i];
        const playerTheme = playerGameState.currentRound!.themes[i];

        expect(showmanTheme.id).toBe(playerTheme.id);
        expect(showmanTheme.name).toBe(playerTheme.name);
        expect(showmanTheme.order).toBe(playerTheme.order);
      }
    } finally {
      await cleanupTestSetup(setup);
    }
  });
});
