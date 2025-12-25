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
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * Edge case tests for game start scenarios:
 * - Starting a finished game
 * - Game with no players (showman only)
 */
describe("Game Start Edge Cases", () => {
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

  describe("Starting Finished Game", () => {
    it("should reject starting a finished game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game first
        await utils.startGame(showmanSocket);

        // Manually finish the game by setting finishedAt
        const game = await utils.getGameFromGameService(gameId);
        game.finish();
        await utils.updateGame(game);

        // Verify game is finished
        const finishedGame = await utils.getGameFromGameService(gameId);
        expect(finishedGame.finishedAt).not.toBeNull();

        // Try to start the game again - should fail
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout - expected error event"));
          }, 5000);

          showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toContain("finished");
            resolve();
          });

          showmanSocket.emit(SocketIOGameEvents.START, {});
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject player ready event on a finished game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start the game first
        await utils.startGame(showmanSocket);

        // Manually finish the game
        const game = await utils.getGameFromGameService(gameId);
        game.finish();
        // Reset startedAt to simulate edge case where game finished without proper start
        game.startedAt = null;
        await utils.updateGame(game);

        // Verify game is finished
        const finishedGame = await utils.getGameFromGameService(gameId);
        expect(finishedGame.finishedAt).not.toBeNull();

        // Try player ready - should be rejected on finished game
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout - expected error event"));
          }, 5000);

          playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toContain("finished");
            resolve();
          });

          playerSockets[0].emit(SocketIOGameEvents.PLAYER_READY);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Game with No Players (Showman Only)", () => {
    it("should start game with null currentTurnPlayerId when only showman exists", async () => {
      // Setup game with no players, only showman
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Verify game state
        const gameState = await utils.getGameState(gameId);
        expect(gameState).not.toBeNull();
        expect(gameState!.currentTurnPlayerId).toBeNull();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow showman to pick questions when currentTurnPlayerId is null", async () => {
      // Setup game with no players, only showman
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is null
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeNull();

        // Showman should be able to pick a question
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();

        // Verify question was picked
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentQuestion).not.toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow showman to pick questions when player joins mid-game and leaves", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is set
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBe(
          setup.playerUsers[0].id
        );

        // Player leaves
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Verify currentTurnPlayerId is cleared
        const gameStateAfterLeave = await utils.getGameState(gameId);
        expect(gameStateAfterLeave!.currentTurnPlayerId).toBeNull();

        // Showman should still be able to pick questions
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow showman to set currentTurnPlayerId to null via turn player change", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is set
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeDefined();

        // Showman sets turn player to null (removes picking right)
        const turnChangePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.TURN_PLAYER_CHANGED
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: null,
        });

        await turnChangePromise;

        // Verify currentTurnPlayerId is null
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();

        // Showman should still be able to pick questions
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject player picking question when not their turn and currentTurnPlayerId is set", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Get current turn player
        const gameState = await utils.getGameState(gameId);
        const currentTurnPlayerId = gameState!.currentTurnPlayerId!;

        // Find the player who is NOT the current turn player
        const notTurnPlayerIndex = playerUsers.findIndex(
          (u) => u.id !== currentTurnPlayerId
        );
        expect(notTurnPlayerIndex).toBeGreaterThanOrEqual(0);

        const notTurnPlayerSocket = playerSockets[notTurnPlayerIndex];

        // Non-turn player tries to pick question - should fail
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout - expected error event"));
          }, 5000);

          notTurnPlayerSocket.on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toContain("turn");
            resolve();
          });

          notTurnPlayerSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId,
          });
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Start While Joining - Queue System Protection", () => {
    it("should handle concurrent join and start operations safely", async () => {
      // Setup game with showman only
      const { socket: showmanSocket, gameId } =
        await utils.createGameWithShowman(app, userRepo);

      try {
        // Create multiple players to join
        const playerClients = await Promise.all(
          Array(3)
            .fill(null)
            .map(() => utils.createGameClient(app, userRepo))
        );

        // Start game and joins concurrently
        const startPromise = utils.startGame(showmanSocket);
        const joinPromises = playerClients.map((client) =>
          utils.joinGame(client.socket, gameId, PlayerRole.PLAYER)
        );

        // Wait for all operations to complete
        await Promise.all([startPromise, ...joinPromises]);

        // Verify game started successfully
        const game = await utils.getGameFromGameService(gameId);
        expect(game.startedAt).not.toBeNull();

        // Cleanup player sockets
        await Promise.all(
          playerClients.map((client) =>
            utils.disconnectAndCleanup(client.socket)
          )
        );
      } finally {
        await utils.disconnectAndCleanup(showmanSocket);
      }
    });
  });
});
