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
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * Tests for Edge Case: Turn Player Validation
 *
 * When showman tries to change turn to an invalid player:
 * - Non-existent player → should be rejected
 * - Spectator player → should be rejected
 * - Disconnected player → should be rejected
 */
describe("Turn Player Change Validation Edge Cases", () => {
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

  describe("Turn Change to Non-Existent Player", () => {
    it("should reject turn change to non-existent player ID", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Non-existent player ID
        const nonExistentPlayerId = 999999;

        // Wait for error
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: nonExistentPlayerId,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Verify current turn player is unchanged
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).not.toBe(nonExistentPlayerId);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject turn change to player not in this game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Create a user who is not in this game
        const { user: outsideUser, socket: outsideSocket } =
          await utils.createGameClient(app, userRepo);

        // Wait for error
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: outsideUser.id,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Verify current turn player is unchanged
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).not.toBe(outsideUser.id);

        // Cleanup outsider socket
        await utils.disconnectAndCleanup(outsideSocket);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Turn Change to Spectator", () => {
    it("should reject turn change to spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      const { showmanSocket, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Get the spectator from game - they should have been created as part of setup
        const game = await utils.getGameFromGameService(gameId);
        const spectator = game.players.find(
          (p) => p.role === PlayerRole.SPECTATOR
        );
        expect(spectator).toBeDefined();

        // Wait for error when trying to set turn to spectator
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: spectator!.meta.id,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Verify turn is still on a valid player
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).not.toBe(spectator!.meta.id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject turn change to player who was restricted to spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Restrict player 0 to spectator
        const restrictionPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[0].id,
          muted: false,
          restricted: true,
          banned: false,
        });

        await restrictionPromise;

        // Wait for error when trying to set turn to restricted player
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: playerUsers[0].id,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Turn should NOT be on the restricted player
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.currentTurnPlayerId).not.toBe(playerUsers[0].id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Turn Change to Disconnected Player", () => {
    it("should reject turn change to disconnected player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Get current turn player to make sure we don't pick them for disconnect
        const gameStateBefore = await utils.getGameState(gameId);
        const currentTurn = gameStateBefore!.currentTurnPlayerId;

        // Find a player who is NOT the current turn player to disconnect
        const playerToDisconnect = playerUsers.find(
          (u) => u.id !== currentTurn
        )!;
        const playerIndex = playerUsers.indexOf(playerToDisconnect);

        // Wait for leave event after disconnect (disconnect triggers LEAVE event)
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE,
          3000
        );

        // Disconnect this player (simulate connection drop)
        playerSockets[playerIndex].disconnect();

        await leavePromise;

        // Verify player is actually disconnected
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerToDisconnect.id, {
          fetchDisconnected: true,
        });
        expect(player?.gameStatus).toBe(PlayerGameStatus.DISCONNECTED);

        // Wait for error when trying to set turn to disconnected player
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: playerToDisconnect.id,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Verify turn was NOT changed to disconnected player
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).not.toBe(
          playerToDisconnect.id
        );
      } finally {
        // Remove the disconnected socket from cleanup list
        const playerToDisconnect = playerUsers.find(
          (u) => u.id !== setup.playerUsers[0].id
        );
        const disconnectedIndex = playerUsers.findIndex(
          (u) => u.id === playerToDisconnect?.id
        );
        setup.playerSockets = playerSockets.filter(
          (_, i) => i !== disconnectedIndex
        );
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject turn change to player who left the game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Get current turn player to make sure we don't pick them for leave
        const gameStateBefore = await utils.getGameState(gameId);
        const currentTurn = gameStateBefore!.currentTurnPlayerId;

        // Find a player who is NOT the current turn player
        const playerToLeave = playerUsers.find((u) => u.id !== currentTurn)!;
        const playerIndex = playerUsers.indexOf(playerToLeave);

        // Player leaves the game
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );

        playerSockets[playerIndex].emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Wait for error when trying to set turn to player who left
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR,
          2000
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: playerToLeave.id,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Player not found");

        // Verify turn was NOT changed to the player who left
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).not.toBe(playerToLeave.id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Valid Turn Changes", () => {
    it("should allow turn change to valid active player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Get the other player (not current turn)
        const gameStateBefore = await utils.getGameState(gameId);
        const currentTurn = gameStateBefore!.currentTurnPlayerId;
        const otherPlayer = playerUsers.find((u) => u.id !== currentTurn)!;

        // Set turn to other player
        await utils.setCurrentTurnPlayer(showmanSocket, otherPlayer.id);

        // Verify turn was changed
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBe(otherPlayer.id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow setting turn to null", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Verify we have a turn player
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeDefined();

        // Set turn to null
        const turnChangePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.TURN_PLAYER_CHANGED
        );

        showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId: null,
        });

        await turnChangePromise;

        // Verify turn was set to null
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
