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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

/**
 * Tests for GameStateTimerDTO.resumedAt field
 *
 * The resumedAt field tracks when a timer was resumed after being paused or restored.
 * This is critical for users joining mid-game to calculate the correct elapsed time.
 *
 * Use cases:
 * 1. Timer resumed after game unpause
 * 2. Timer restored after wrong answer (back to SHOWING state)
 * 3. Timer restored after answer timeout expiration
 */
describe("Timer resumedAt Field", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let testUtils: TestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new SocketGameTestUtils(serverUrl);
    testUtils = new TestUtils(app, userRepo, serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Timer initialization", () => {
    it("should have null resumedAt when timer is first started", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Pick a question to start timer
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify timer exists and resumedAt is null (fresh timer)
        const gameState = await utils.getGameState(gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
        expect(gameState!.timer).toBeDefined();
        expect(gameState!.timer!.resumedAt).toBeNull();
        expect(gameState!.timer!.startedAt).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Timer resume after unpause", () => {
    it("should set resumedAt when game is unpaused", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer state - resumedAt should be null
        const initialState = await utils.getGameState(gameId);
        expect(initialState!.timer!.resumedAt).toBeNull();

        // Pause game
        const pausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify paused timer has elapsed time tracked
        expect(pauseData.timer).toBeDefined();
        expect(pauseData.timer.elapsedMs).toBeGreaterThanOrEqual(0);

        // Unpause game
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        // Verify resumed timer has resumedAt set
        expect(unpauseData.timer).toBeDefined();
        expect(unpauseData.timer.resumedAt).toBeDefined();
        expect(unpauseData.timer.resumedAt).not.toBeNull();

        // Verify game state also has resumedAt
        const resumedState = await utils.getGameState(gameId);
        expect(resumedState!.timer!.resumedAt).toBeDefined();
        expect(resumedState!.timer!.resumedAt).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should have resumedAt as a valid Date close to current time", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Pause and unpause
        await utils.pauseGame(showmanSocket);

        const beforeUnpause = new Date();
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;
        const afterUnpause = new Date();

        // Verify resumedAt is within expected time range
        const resumedAt = new Date(unpauseData.timer.resumedAt);
        expect(resumedAt.getTime()).toBeGreaterThanOrEqual(
          beforeUnpause.getTime() - 100 // 100ms tolerance
        );
        expect(resumedAt.getTime()).toBeLessThanOrEqual(
          afterUnpause.getTime() + 100
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should update resumedAt on subsequent pause/unpause cycles", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First pause/unpause cycle
        await utils.pauseGame(showmanSocket);
        let unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const firstUnpause = await unpausePromise;
        const firstResumedAt = new Date(firstUnpause.timer.resumedAt).getTime();

        // Second pause/unpause cycle
        await utils.pauseGame(showmanSocket);
        unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const secondUnpause = await unpausePromise;
        const secondResumedAt = new Date(
          secondUnpause.timer.resumedAt
        ).getTime();

        // Second resumedAt should be later than first
        expect(secondResumedAt).toBeGreaterThan(firstResumedAt);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Timer resume after wrong answer", () => {
    it("should set resumedAt when timer is restored after wrong answer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer has no resumedAt
        const showingState = await utils.getGameState(gameId);
        expect(showingState!.timer!.resumedAt).toBeNull();

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);

        // Showman marks as wrong
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });
        const answerResult = await answerResultPromise;

        // Timer should be restored with resumedAt set
        // (only if there are other players who haven't answered)
        expect(answerResult.timer).toBeDefined();
        expect(answerResult.timer.resumedAt).toBeDefined();
        expect(answerResult.timer.resumedAt).not.toBeNull();

        // Verify game state
        const restoredState = await utils.getGameState(gameId);
        expect(restoredState!.questionState).toBe(QuestionState.SHOWING);
        expect(restoredState!.timer!.resumedAt).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should preserve elapsedMs when timer is restored after wrong answer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial timer state
        const initialState = await utils.getGameState(gameId);
        const initialDurationMs = initialState!.timer!.durationMs;

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Showman marks as wrong
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100,
        });
        const answerResult = await answerResultPromise;

        // Verify timer properties
        expect(answerResult.timer.durationMs).toBe(initialDurationMs);
        expect(answerResult.timer.elapsedMs).toBeGreaterThan(0);
        expect(answerResult.timer.resumedAt).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Timer resume after answer timeout", () => {
    it("should set resumedAt when timer is restored after answer timeout", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer has no resumedAt
        const showingState = await utils.getGameState(gameId);
        expect(showingState!.timer!.resumedAt).toBeNull();

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);

        // Wait for answer result event from timer expiration
        const answerResultPromise = utils.waitForEvent(
          playerSockets[1], // Listen on second player
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Expire the answering timer
        await testUtils.expireTimer(gameId);

        const answerResult = await answerResultPromise;

        // Timer should be restored with resumedAt set
        expect(answerResult.timer).toBeDefined();
        expect(answerResult.timer.resumedAt).toBeDefined();
        expect(answerResult.timer.resumedAt).not.toBeNull();

        // Verify game returned to SHOWING state
        const restoredState = await utils.getGameState(gameId);
        expect(restoredState!.questionState).toBe(QuestionState.SHOWING);
        expect(restoredState!.timer!.resumedAt).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("User joining mid-game with resumed timer", () => {
    it("should receive timer with resumedAt when joining after game unpause", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const gameDataAfterPause = await utils.getGameState(gameId);
        expect(gameDataAfterPause!.timer).toBeDefined();
        expect(gameDataAfterPause!.timer!.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(gameDataAfterPause!.timer!.resumedAt).toBeNull();

        // Pause and unpause to set resumedAt
        await utils.pauseGame(showmanSocket);
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // New player joins
        const { socket: newPlayerSocket } = await utils.createGameClient(
          app,
          userRepo
        );
        const gameData = await utils.joinSpecificGameWithData(
          newPlayerSocket,
          gameId,
          PlayerRole.PLAYER
        );

        // Verify new player receives game state with resumedAt
        expect(gameData.gameState.timer).toBeDefined();
        expect(gameData.gameState.timer!.resumedAt).not.toBeNull();

        // Cleanup new socket
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    }, 35000);
  });
});
