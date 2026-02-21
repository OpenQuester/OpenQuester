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
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Socket Game Flow Tests", () => {
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
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
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

  it("should set currentTurnPlayerId to the player with the lowest score on simple round start", async () => {
    // Setup a game with 3 players and two simple rounds (no final round)
    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      3,
      0,
      false
    );
    const { showmanSocket } = setup;

    // Start the game
    await utils.startGame(showmanSocket);

    // Artificially set player scores
    // Player 0: 10, Player 1: -5, Player 2: 0
    await utils.setPlayerScore(setup.gameId, setup.playerUsers[0].id, 10);
    await utils.setPlayerScore(setup.gameId, setup.playerUsers[1].id, -5);
    await utils.setPlayerScore(setup.gameId, setup.playerUsers[2].id, 0);

    // Progress to next round (should be simple round)
    const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
      showmanSocket,
      SocketIOGameEvents.NEXT_ROUND
    );
    await utils.progressToNextRound(showmanSocket);
    const { gameState } = await nextRoundPromise;

    // The player with the lowest score (-5) should be the currentTurnPlayerId
    expect(gameState.currentRound!.type).toBe(PackageRoundType.SIMPLE);
    expect(gameState.currentTurnPlayerId).toBe(setup.playerUsers[1].id);

    await utils.cleanupGameClients(setup);
  });

  describe("Game Joining Flow", () => {
    it("should allow normal game joining", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(1);

      await utils.cleanupGameClients(setup);
    });

    it("should allow spectator joining", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);

      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(1);
      expect(setup.spectatorSockets).toHaveLength(1);

      const spectator = setup.spectatorSockets[0];
      expect(spectator).toBeDefined();

      await utils.cleanupGameClients(setup);
    });
  });

  describe("Game Leaving Flow", () => {
    it("should handle player leaving gracefully", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { playerSockets, showmanSocket } = setup;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        // Listen for leave event on other sockets
        showmanSocket.on(SocketIOGameEvents.LEAVE, (data: any) => {
          clearTimeout(timeout);
          expect(data).toBeDefined();
          resolve();
        });

        // Player leaves the game
        void utils.leaveGame(playerSockets[0]).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle showman leaving", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        // Listen for leave event on player socket
        playerSockets[0].on(SocketIOGameEvents.LEAVE, (data: any) => {
          clearTimeout(timeout);
          expect(data).toBeDefined();
          resolve();
        });

        // Showman leaves the game
        void utils.leaveGame(showmanSocket).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Game Start Flow", () => {
    it("should allow showman to start the game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        // Listen for start event on player socket
        playerSockets[0].on(SocketIOGameEvents.START, (data: any) => {
          clearTimeout(timeout);
          expect(data.currentRound).toBeDefined();
          resolve();
        });

        // Start the game
        void utils.startGame(showmanSocket).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should reject player to start the game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets } = setup;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("Only showman can start the game");
          resolve();
        });

        // Try to start game as player
        playerSockets[0].emit(SocketIOGameEvents.START, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });
});
