import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import { type Express } from "express";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "../utils/SocketIOGameTestUtils";

describe("SocketIOGameLobby", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
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
  });

  it("should allow players to join a game", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Get game state directly from service since socket has already joined
      const gameState = await utils.getGameState(setup.gameId);
      expect(gameState).toBeDefined();

      // Verify the setup was successful
      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(1);
      expect(setup.spectatorSockets).toHaveLength(0);

      // Get socket user data to verify join was successful
      const showmanUserData = await utils.getSocketUserData(
        setup.showmanSocket
      );
      const playerUserData = await utils.getSocketUserData(
        setup.playerSockets[0]
      );

      expect(showmanUserData?.gameId).toBe(setup.gameId);
      expect(playerUserData?.gameId).toBe(setup.gameId);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should support multiple players joining", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);

    try {
      // Verify the setup was successful
      expect(setup.gameId).toBeDefined();
      expect(setup.showmanSocket).toBeDefined();
      expect(setup.playerSockets).toHaveLength(3);
      expect(setup.spectatorSockets).toHaveLength(0);

      // Verify all sockets are connected to the game
      const showmanUserData = await utils.getSocketUserData(
        setup.showmanSocket
      );
      expect(showmanUserData?.gameId).toBe(setup.gameId);

      for (let i = 0; i < setup.playerSockets.length; i++) {
        const playerUserData = await utils.getSocketUserData(
          setup.playerSockets[i]
        );
        expect(playerUserData?.gameId).toBe(setup.gameId);
      }
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should handle player leaving the game", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Leave game
      await new Promise<void>((resolve) => {
        setup.playerSockets[0].once(
          SocketIOGameEvents.LEAVE,
          (response: GameLeaveEventPayload) => {
            expect(response).toBeDefined();
            expect(response.user).toBeDefined();
            resolve();
          }
        );

        setup.playerSockets[0].emit(SocketIOGameEvents.LEAVE);
      });
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it.skip("should handle concurrent join/leave operations", () => {
    // TODO: Test player joining and leaving rapidly
    // Expected: Should handle concurrent operations safely
    // Flow:
    // 1. Create game
    // 2. Player rapidly sends JOIN and LEAVE events
    // 3. Verify final player state is consistent
    // 4. Verify no orphaned player data
  });
});
