import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";

import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("SocketIOGameReady", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: any;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    const keysUpdated = await redisClient.keys("*");
    if (keysUpdated.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }

    userRepo = testEnv.getDatabase().getRepository(User);
  });

  describe("Player Ready Functionality", () => {
    it("should allow player to set ready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        // Listen for ready event on showman socket
        const readyEventPromise = utils.waitForPlayerReady(showmanSocket);

        // Player sets ready
        await utils.setPlayerReady(playerSockets[0]);

        // Verify the event was broadcasted correctly
        const readyData = await readyEventPromise;
        expect(readyData.playerId).toBe(setup.playerUsers[0].id);
        expect(readyData.isReady).toBe(true);
        expect(readyData.readyPlayers).toContain(setup.playerUsers[0].id);
        expect(readyData.autoStartTriggered).toBe(true); // Single player should trigger auto-start
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow player to set unready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0); // Use 2 players so auto-start doesn't trigger
      const { playerSockets, showmanSocket } = setup;

      try {
        // First set player ready
        await utils.setPlayerReady(playerSockets[0]);

        // Listen for unready event on showman socket
        const unreadyEventPromise = utils.waitForPlayerUnready(showmanSocket);

        // Player sets unready
        await utils.setPlayerUnready(playerSockets[0]);

        // Verify the event was broadcasted correctly
        const unreadyData = await unreadyEventPromise;
        expect(unreadyData.playerId).toBe(setup.playerUsers[0].id);
        expect(unreadyData.isReady).toBe(false);
        expect(unreadyData.readyPlayers).not.toContain(setup.playerUsers[0].id);
        expect(unreadyData.autoStartTriggered).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should trigger auto-start when all players are ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        let gameStarted = false;

        // Listen for game start event
        showmanSocket.on(SocketIOGameEvents.START, () => {
          gameStarted = true;
        });

        const noStartPromise = utils.waitForNoEvent(
          showmanSocket,
          SocketIOGameEvents.START
        );
        // Set first two players ready (should not auto-start yet)
        await utils.setPlayerReady(playerSockets[0]);
        await utils.setPlayerReady(playerSockets[1]);

        await noStartPromise;

        expect(gameStarted).toBe(false);

        const startPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.START
        );

        // Third player ready should trigger auto-start
        await utils.setPlayerReady(playerSockets[2]);

        await startPromise;

        expect(gameStarted).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not count showman as required for ready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        let gameStarted = false;

        // Listen for game start event
        showmanSocket.on(SocketIOGameEvents.START, () => {
          gameStarted = true;
        });

        const startPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.START
        );

        // Single player ready should trigger auto-start
        await utils.setPlayerReady(playerSockets[0]);

        await startPromise;

        expect(gameStarted).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should remove player from ready list when they leave", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0); // Use 3 players so auto-start doesn't trigger with 2
      const { showmanSocket, playerSockets } = setup;

      try {
        // Set two players ready (but not all three, so no auto-start)

        const readyPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_READY
        );
        await utils.setPlayerReady(playerSockets[0]);
        await readyPromise;

        const readyPromise2 = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_READY
        );
        await utils.setPlayerReady(playerSockets[1]);
        await readyPromise2;

        // Verify initial state
        const beforeLeave = await utils.getGameState(setup.gameId);

        // Ensure we have both players ready before proceeding
        expect(beforeLeave?.readyPlayers).toBeDefined();
        expect(beforeLeave!.readyPlayers).toHaveLength(2);
        expect(beforeLeave!.readyPlayers).toContain(setup.playerUsers[0].id);
        expect(beforeLeave!.readyPlayers).toContain(setup.playerUsers[1].id);

        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        // First player disconnects (which triggers ready state cleanup)
        await utils.disconnectAndCleanup(playerSockets[0]);

        await leavePromise;

        const gameState = await utils.getGameState(setup.gameId);

        // Check game state - should only have second player ready
        expect(gameState?.readyPlayers).toBeDefined();
        expect(gameState!.readyPlayers).toHaveLength(1);
        expect(gameState!.readyPlayers).toContain(setup.playerUsers[1].id);
        expect(gameState!.readyPlayers).not.toContain(setup.playerUsers[0].id);
      } finally {
        // Remove the disconnected socket from cleanup since we already handled it
        setup.playerSockets.splice(0, 1);
        await utils.cleanupGameClients(setup);
      }
    });

    it("should clear ready state when game starts manually", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        // Set one player ready (but not all)
        await utils.setPlayerReady(playerSockets[0]);

        // Showman starts game manually
        await utils.startGame(showmanSocket);

        // Check game state - ready list should be cleared
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.readyPlayers).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Ready Error Cases", () => {
    it("should reject spectators trying to set ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
      const { spectatorSockets } = setup;

      try {
        // Spectator tries to set ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          spectatorSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            expect(error.message).toContain("player"); // Should mention only players can set ready
            resolve();
          });

          spectatorSockets[0].emit(SocketIOGameEvents.PLAYER_READY);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject showman trying to set ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      try {
        // Showman tries to set ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            expect(error.message).toContain("player"); // Should mention only players can set ready
            resolve();
          });

          showmanSocket.emit(SocketIOGameEvents.PLAYER_READY);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject players trying to set ready when game is started", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Player tries to set ready after game started
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toContain("already started");
            resolve();
          });

          playerSockets[0].emit(SocketIOGameEvents.PLAYER_READY);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject players not in a game trying to set ready", async () => {
      const { socket: outsider } = await utils.createGameClient(app, userRepo);

      try {
        // Outsider tries to set ready
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          outsider.on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            resolve();
          });

          outsider.emit(SocketIOGameEvents.PLAYER_READY);
        });
      } finally {
        await utils.disconnectAndCleanup(outsider);
      }
    });
  });

  describe("Player Ready State Synchronization", () => {
    it("should handle multiple players setting ready/unready rapidly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 0);
      const { playerSockets, showmanSocket } = setup;

      try {
        const readyEvents: PlayerReadinessBroadcastData[] = [];
        const unreadyEvents: PlayerReadinessBroadcastData[] = [];

        // Listen for all ready/unready events
        showmanSocket.on(SocketIOGameEvents.PLAYER_READY, (data) => {
          readyEvents.push(data);
        });
        showmanSocket.on(SocketIOGameEvents.PLAYER_UNREADY, (data) => {
          unreadyEvents.push(data);
        });

        // Rapid ready/unready operations
        await Promise.all([
          utils.setPlayerReady(playerSockets[0]),
          utils.setPlayerReady(playerSockets[1]),
          utils.setPlayerReady(playerSockets[2]),
          utils.setPlayerReady(playerSockets[3]),
          utils.setPlayerReady(playerSockets[4]),
          utils.setPlayerReady(playerSockets[5]),
          utils.setPlayerReady(playerSockets[6]),
          utils.setPlayerReady(playerSockets[7]),
          utils.setPlayerReady(playerSockets[8]),
          utils.setPlayerReady(playerSockets[9]),
        ]);

        await Promise.all([
          utils.setPlayerUnready(playerSockets[0]),
          utils.setPlayerUnready(playerSockets[1]),
          utils.setPlayerUnready(playerSockets[2]),
          utils.setPlayerUnready(playerSockets[3]),
          utils.setPlayerUnready(playerSockets[4]),
          utils.setPlayerUnready(playerSockets[5]),
          utils.setPlayerUnready(playerSockets[6]),
          utils.setPlayerUnready(playerSockets[7]),
          utils.setPlayerUnready(playerSockets[8]),
        ]);

        // Verify final state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.readyPlayers).toHaveLength(1);
        expect(gameState?.readyPlayers).toContain(setup.playerUsers[9].id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should maintain ready state consistency during player joins/leaves", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0); // Use 3 players so no auto-start
      const { playerSockets } = setup;

      try {
        // Set two players ready (but not all, so no auto-start)
        await utils.setPlayerReady(playerSockets[0]);
        await utils.setPlayerReady(playerSockets[1]);

        // Add a new player
        const { socket: newPlayer } = await utils.createGameClient(
          app,
          userRepo
        );
        await utils.joinGame(newPlayer, setup.gameId, PlayerRole.PLAYER);

        // Verify ready state is preserved for existing players
        const gameStateAfterJoin = await utils.getGameState(setup.gameId);
        expect(gameStateAfterJoin?.readyPlayers).toHaveLength(2);
        expect(gameStateAfterJoin?.readyPlayers).toContain(
          setup.playerUsers[0].id
        );
        expect(gameStateAfterJoin?.readyPlayers).toContain(
          setup.playerUsers[1].id
        );

        // New player should not be ready
        expect(await utils.areAllPlayersReady(setup.gameId)).toBe(false);

        await utils.disconnectAndCleanup(newPlayer);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
