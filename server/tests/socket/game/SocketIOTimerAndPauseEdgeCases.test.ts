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
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Socket Timer and Pause Edge Cases", () => {
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
    const redisClient = RedisConfig.getClient();
    await redisClient.del(...(await redisClient.keys("*")));
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Game Pause Edge Cases", () => {
    it("should handle pausing game during question selection", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game and enter question selection phase
        await utils.startGame(showmanSocket);

        // Game should be in CHOOSING state with no current question
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
        expect(gameState!.currentQuestion).toBeNull();

        // Pause game during selection phase
        const pausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify game is paused and timer state is preserved
        expect(pauseData.timer).toBeDefined();
        const pausedGameState = await utils.getGameState(setup.gameId);
        expect(pausedGameState).toBeDefined();
        expect(pausedGameState!.isPaused).toBe(true);
        expect(pausedGameState!.questionState).toBe(QuestionState.CHOOSING);

        // Resume and verify continuation
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        expect(unpauseData.timer).toBeDefined();
        const resumedGameState = await utils.getGameState(setup.gameId);
        expect(resumedGameState).toBeDefined();
        expect(resumedGameState!.isPaused).toBe(false);
        expect(resumedGameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle pausing game during active answer period", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Present question and start answer timer
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state
        const showingState = await utils.getGameState(setup.gameId);
        expect(showingState).toBeDefined();
        expect(showingState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingState!.currentQuestion).toBeDefined();
        expect(showingState!.timer).toBeDefined();

        // Player starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify game is in ANSWERING state
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Pause game mid-answer period
        const pausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify answer timer pause and answer state preservation
        expect(pauseData.timer).toBeDefined();
        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);
        expect(pausedState!.questionState).toBe(QuestionState.ANSWERING);
        expect(pausedState!.answeringPlayer).toBeDefined();

        // Resume and verify continuation
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        expect(unpauseData.timer).toBeDefined();
        const resumedState = await utils.getGameState(setup.gameId);
        expect(resumedState).toBeDefined();
        expect(resumedState!.isPaused).toBe(false);
        expect(resumedState!.questionState).toBe(QuestionState.ANSWERING);
        expect(resumedState!.answeringPlayer).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    }, 20000); // Increased timeout to account for media download timeout

    it("should handle pausing already paused game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      try {
        // Start and pause game
        await utils.startGame(showmanSocket);
        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);

        // Send another PAUSE_GAME event - should emit error
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
        const errorData = await errorPromise;

        // Verify error message
        expect(errorData.message).toBe("Game is paused");

        // Verify game remains paused
        const stillPausedState = await utils.getGameState(setup.gameId);
        expect(stillPausedState).toBeDefined();
        expect(stillPausedState!.isPaused).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Game Resume Edge Cases", () => {
    it("should handle resuming non-paused game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game (not paused)
        await utils.startGame(showmanSocket);

        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.isPaused).toBe(false);

        // Send RESUME_GAME event - should handle gracefully
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        // Verify appropriate handling - game remains unpaused
        expect(unpauseData.timer).toBeDefined();
        const stillUnpausedState = await utils.getGameState(setup.gameId);
        expect(stillUnpausedState).toBeDefined();
        expect(stillUnpausedState!.isPaused).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle multiple resume requests", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Pause game
        await utils.startGame(showmanSocket);
        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);

        // Send multiple RESUME_GAME events rapidly
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );

        for (let i = 0; i < 5; i++) {
          showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        }

        // Verify single resume occurs
        const unpauseData = await unpausePromise;
        expect(unpauseData.timer).toBeDefined();

        // Verify game state consistency
        const resumedState = await utils.getGameState(setup.gameId);
        expect(resumedState).toBeDefined();
        expect(resumedState!.isPaused).toBe(false);

        // Ensure game state is consistent
        const finalGameFromService = await utils.getGameFromGameService(
          setup.gameId
        );
        expect(finalGameFromService.gameState.isPaused).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
