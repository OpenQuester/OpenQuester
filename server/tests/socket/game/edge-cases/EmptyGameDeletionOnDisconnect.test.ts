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

import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

describe("Empty game deletion on disconnect", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let socketUtils: SocketGameTestUtils;
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
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    socketUtils = new SocketGameTestUtils(serverUrl);
    testUtils = new TestUtils(app, userRepo, serverUrl);
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

  it("should delete game when last user disconnects before game start", async () => {
    const setup = await socketUtils.setupGameTestEnvironment(
      userRepo,
      app,
      0,
      0
    );
    const { gameId, showmanSocket } = setup;

    try {
      await socketUtils.disconnectAndCleanup(showmanSocket);

      const deleted = await testUtils.waitForCondition(
        async () => {
          try {
            await testUtils.getGameEntity(gameId);
            return false;
          } catch {
            return true;
          }
        },
        2000,
        50
      );

      expect(deleted).toBe(true);
    } finally {
      await socketUtils.disconnectAndCleanup(showmanSocket);
    }
  });

  it("should delete game when last user disconnects after game is finished", async () => {
    const setup = await socketUtils.setupGameTestEnvironment(
      userRepo,
      app,
      0,
      0
    );
    const { gameId, showmanSocket } = setup;

    try {
      const game = await testUtils.getGameEntity(gameId);
      game.startedAt = new Date();
      game.finish();
      await testUtils.updateGame(game);

      await socketUtils.disconnectAndCleanup(showmanSocket);

      const deleted = await testUtils.waitForCondition(
        async () => {
          try {
            await testUtils.getGameEntity(gameId);
            return false;
          } catch {
            return true;
          }
        },
        2000,
        50
      );

      expect(deleted).toBe(true);
    } finally {
      await socketUtils.disconnectAndCleanup(showmanSocket);
    }
  });
});
