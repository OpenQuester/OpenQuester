import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

/**
 * Edge case tests for game start scenarios:
 * - Starting a finished game
 * - Game with no players (showman only)
 */
describe("Game Start Edge Cases", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Starting Finished Game", () => {
    it("should reject starting a finished game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game first
        await utils.startGame(showmanSocket);

        // Manually finish the game by setting finishedAt
        const game = await utils.getGameFromGameService(gameId);
        game.finish();
        await utils.updateGame(game);

        // Verify game is finished
        const finishedGame = await utils.getGameFromGameService(gameId);
        expect(finishedGame.finishedAt).not.toBeNull();

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          showmanSocket,
          SocketIOEvents.ERROR
        );

        // Try to start the game again - should fail
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.START, {});

        expect((await errorPromise).message).toContain("finished");
      });
    });

    it("should reject player ready event on a finished game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

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

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Try player ready - should be rejected on finished game
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.PLAYER_READY);

        expect((await errorPromise).message).toContain("finished");
      });
    });
  });

  describe("Game with No Players (Showman Only)", () => {
    it("should start game with null currentTurnPlayerId when only showman exists", async () => {
      await suite.scenario(async () => {
        // Setup game with no players, only showman
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Verify game state
        const gameState = await utils.getGameState(gameId);
        expect(gameState).not.toBeNull();
        expect(gameState!.currentTurnPlayerId).toBeNull();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      });
    });

    it("should allow showman to pick questions when currentTurnPlayerId is null", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with no players, only showman
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is null
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeNull();

        // Showman should be able to pick a question
        const questionDataPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();

        // Verify question was picked
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentQuestion).not.toBeNull();
      });
    });

    it("should allow showman to pick questions when player joins mid-game and leaves", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is set
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBe(setup.playerUsers[0].id);

        // Player leaves
        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Verify currentTurnPlayerId is cleared
        const gameStateAfterLeave = await utils.getGameState(gameId);
        expect(gameStateAfterLeave!.currentTurnPlayerId).toBeNull();

        // Showman should still be able to pick questions
        const questionDataPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();
      });
    });

    it("should allow showman to set currentTurnPlayerId to null via turn player change", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Verify currentTurnPlayerId is set
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeDefined();

        // Showman sets turn player to null (removes picking right)
        const turnChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.TURN_PLAYER_CHANGED
        );

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: null
        });

        await turnChangePromise;

        // Verify currentTurnPlayerId is null
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();

        // Showman should still be able to pick questions
        const questionDataPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const questionId = await utils.getFirstAvailableQuestionId(gameId);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        const questionData = await questionDataPromise;
        expect(questionData).toBeDefined();
      });
    });

    it("should reject player picking question when not their turn and currentTurnPlayerId is set", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Get current turn player
        const gameState = await utils.getGameState(gameId);
        const currentTurnPlayerId = gameState!.currentTurnPlayerId!;

        // Find the player who is NOT the current turn player
        const notTurnPlayerIndex = playerUsers.findIndex((u) => u.id !== currentTurnPlayerId);
        expect(notTurnPlayerIndex).toBeGreaterThanOrEqual(0);

        const notTurnPlayerSocket = playerSockets[notTurnPlayerIndex];

        // Non-turn player tries to pick question - should fail
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        const errorPromise = scenario.waitForEvent<{ message: string }>(
          notTurnPlayerSocket,
          SocketIOEvents.ERROR
        );

        scenario.actor(notTurnPlayerSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId
        });

        expect((await errorPromise).message).toContain("turn");
      });
    });
  });

  describe("Start While Joining - Queue System Protection", () => {
    it("should handle concurrent join and start operations safely", async () => {
      await suite.scenario(async () => {
        // Setup game with showman only
        const { socket: showmanSocket, gameId } = await utils.createGameWithShowman(app, userRepo);

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
      });
    });
  });
});
