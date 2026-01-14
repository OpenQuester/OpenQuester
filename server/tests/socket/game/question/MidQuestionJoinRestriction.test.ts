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
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

/**
 * Tests for mid-question join restriction feature.
 *
 * Players who join a game while a question is already active (not in CHOOSING state)
 * should not be able to answer that question. This prevents unfair advantages and
 * edge cases where players could join, see the question being shown, and buzz in.
 */
describe("Mid-Question Join Restriction", () => {
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
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Players joining during question should not be able to answer", () => {
    it("should reject answer attempt from player who joined during SHOWING state", async () => {
      // Setup: 1 player + showman
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state
        const gameState = await utils.getGameState(gameId);
        expect(gameState?.questionState).toBe(QuestionState.SHOWING);

        // Create new player who joins mid-question
        const { socket: lateJoinerSocket } = await utils.createGameClient(
          app,
          userRepo
        );

        try {
          const joinPromise = utils.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.JOIN
          );
          // Join the game as player during SHOWING state
          await utils.joinGame(lateJoinerSocket, gameId, PlayerRole.PLAYER);

          // Wait for join to complete
          await joinPromise;

          // Attempt to answer - should be rejected
          const errorPromise = new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new Error("No error received - player was able to answer")
              );
            }, 3000);

            lateJoinerSocket.once(SocketIOEvents.ERROR, (error: any) => {
              clearTimeout(timeout);
              resolve(error.message);
            });
          });

          lateJoinerSocket.emit(SocketIOGameEvents.QUESTION_ANSWER, {});

          const errorMessage = await errorPromise;

          // Expect specific error for mid-question join
          expect(errorMessage.toLowerCase()).toContain("cannot answer");
          expect(errorMessage.toLowerCase()).toContain(
            "you will be able to answer the next question"
          );
        } finally {
          await utils.disconnectAndCleanup(lateJoinerSocket);
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject answer attempt from player who joined during ANSWERING state", async () => {
      // Setup: 2 players + showman (one will answer, one joins late)
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First player starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify game is in ANSWERING state
        const gameState = await utils.getGameState(gameId);
        expect(gameState?.questionState).toBe(QuestionState.ANSWERING);

        // Create new player who joins mid-question
        const { socket: lateJoinerSocket } = await utils.createGameClient(
          app,
          userRepo
        );

        try {
          // Join the game as player during ANSWERING state
          await utils.joinGame(lateJoinerSocket, gameId, PlayerRole.PLAYER);

          // Wait for join to complete
          await utils.waitForActionsComplete(gameId);

          // Verify the player cannot answer by checking questionEligiblePlayers
          const updatedState = await utils.getGameState(gameId);
          const game = await utils.getGameFromGameService(gameId);
          const lateJoinerId = (await utils.getSocketUserData(lateJoinerSocket))
            ?.id;

          expect(updatedState?.questionState).toBe(QuestionState.ANSWERING);

          // The late joiner should not be in the eligible players list
          expect(game.gameState.questionEligiblePlayers).toBeDefined();
          expect(
            game.gameState.questionEligiblePlayers?.includes(lateJoinerId!)
          ).toBe(false);
        } finally {
          await utils.disconnectAndCleanup(lateJoinerSocket);
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player reconnection scenarios", () => {
    it("should allow reconnecting player to answer if they were present at question start", async () => {
      // Setup: 1 player + showman
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state and player is eligible
        const gameState = await utils.getGameState(gameId);
        expect(gameState?.questionState).toBe(QuestionState.SHOWING);

        const game = await utils.getGameFromGameService(gameId);
        expect(
          game.gameState.questionEligiblePlayers?.includes(playerUsers[0].id)
        ).toBe(true);

        // Simulate disconnect
        const originalPlayerId = playerUsers[0].id;
        playerSockets[0].disconnect();

        // Wait for disconnect to process
        await utils.waitForActionsComplete(gameId);

        // Reconnect with same user
        const { socket: reconnectedSocket } =
          await utils.createSocketForExistingUser(app, originalPlayerId);

        try {
          // Rejoin the game
          await utils.joinGame(reconnectedSocket, gameId, PlayerRole.PLAYER);

          // Wait for join to complete
          await utils.waitForActionsComplete(gameId);

          // Should still be able to answer (was in eligible list)
          const answerPromise = utils.waitForEvent(
            showmanSocket,
            SocketIOGameEvents.QUESTION_ANSWER,
            3000
          );

          reconnectedSocket.emit(SocketIOGameEvents.QUESTION_ANSWER, {});

          await answerPromise;

          // Verify answer was accepted
          const updatedState = await utils.getGameState(gameId);
          expect(updatedState?.questionState).toBe(QuestionState.ANSWERING);
          expect(updatedState?.answeringPlayer).toBe(originalPlayerId);
        } finally {
          await utils.disconnectAndCleanup(reconnectedSocket);
        }
      } finally {
        // Note: playerSockets[0] is already disconnected
        await utils.disconnectAndCleanup(showmanSocket);
      }
    });
  });

  describe("State reset on new question", () => {
    it("should clear eligibility restrictions when returning to CHOOSING state", async () => {
      // Setup: 2 players initially (so we don't auto-advance to answering), will add late joiner
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2, // 2 players needed to avoid auto-advance to ANSWERING
        0,
        true,
        1 // Include additional simple question
      );
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick first question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Late joiner joins during question
        const { socket: lateJoinerSocket, user: lateJoinerUser } =
          await utils.createGameClient(app, userRepo);

        try {
          await utils.joinGame(lateJoinerSocket, gameId, PlayerRole.PLAYER);
          await utils.waitForActionsComplete(gameId);

          // Verify late joiner is NOT eligible for this question
          const game = await utils.getGameFromGameService(gameId);
          expect(
            game.gameState.questionEligiblePlayers?.includes(lateJoinerUser.id)
          ).toBe(false);

          // Complete the question (force skip)
          await utils.skipQuestion(showmanSocket);
          await utils.skipShowAnswer(showmanSocket);

          // Wait for state to return to CHOOSING
          await utils.waitForActionsComplete(gameId);
          const stateAfterSkip = await utils.getGameState(gameId);
          expect(stateAfterSkip?.questionState).toBe(QuestionState.CHOOSING);

          // questionEligiblePlayers should be cleared
          const gameAfterSkip = await utils.getGameFromGameService(gameId);
          expect(gameAfterSkip.gameState.questionEligiblePlayers).toBeNull();

          // Pick another question - late joiner should now be eligible
          // Use both player sockets for media download
          const allPlayerSockets = [...playerSockets, lateJoinerSocket];
          await utils.pickQuestion(showmanSocket, undefined, allPlayerSockets);

          // Verify late joiner IS eligible for new question
          const gameNewQuestion = await utils.getGameFromGameService(gameId);
          expect(
            gameNewQuestion.gameState.questionEligiblePlayers?.includes(
              lateJoinerUser.id
            )
          ).toBe(true);
        } finally {
          await utils.disconnectAndCleanup(lateJoinerSocket);
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Role change scenarios", () => {
    it("should not allow spectator-turned-player to answer if changed mid-question", async () => {
      // Setup: 1 player + 1 spectator + showman
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
      const { showmanSocket, playerSockets, spectatorSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get spectator's user ID
        const spectatorData = await utils.getSocketUserData(
          spectatorSockets[0]
        );
        const spectatorUserId = spectatorData?.id;

        // Verify spectator is NOT in eligible list (was spectator at question start)
        const game = await utils.getGameFromGameService(gameId);
        expect(
          game.gameState.questionEligiblePlayers?.includes(spectatorUserId!)
        ).toBe(false);

        // Change spectator to player mid-question
        const roleChangePromise = utils.waitForEvent(
          spectatorSockets[0],
          SocketIOGameEvents.PLAYER_ROLE_CHANGE,
          3000
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: spectatorUserId,
          newRole: PlayerRole.PLAYER,
        });

        await roleChangePromise;
        await utils.waitForActionsComplete(gameId);

        // Verify the role was actually changed
        const gameAfterRoleChange = await utils.getGameFromGameService(gameId);
        const changedPlayer = gameAfterRoleChange.getPlayer(spectatorUserId!, {
          fetchDisconnected: false,
        });
        expect(changedPlayer?.role).toBe(PlayerRole.PLAYER);

        // Verify player is still NOT in eligible list (even after role change)
        expect(
          gameAfterRoleChange.gameState.questionEligiblePlayers?.includes(
            spectatorUserId!
          )
        ).toBe(false);

        // Attempt to answer - should be rejected because not in eligible list
        const errorPromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(
                "No error received - spectator-turned-player was able to answer"
              )
            );
          }, 3000);

          spectatorSockets[0].once(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            resolve(error.message);
          });
        });

        spectatorSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER, {});

        const errorMessage = await errorPromise;

        expect(errorMessage.toLowerCase()).toContain("cannot answer");
        expect(errorMessage.toLowerCase()).toContain(
          "you will be able to answer the next question"
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
