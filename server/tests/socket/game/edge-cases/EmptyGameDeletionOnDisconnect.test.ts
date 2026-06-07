import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";
import request from "supertest";
import { Repository } from "typeorm";

import { User } from "infrastructure/database/models/User";
import { ILogger } from "shared/logging/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

describe("Empty game deletion on last user exit", () => {
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
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
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

  const expectGameRemovedFromLobbyIndexes = async (gameId: string): Promise<void> => {
    const { cookie } = await testUtils.createAndLoginUser(`lobby-index-${gameId}`);
    const listRes = await request(app)
      .get("/v1/games")
      .set("Cookie", cookie)
      .query({ limit: 10, offset: 0 });

    expect(listRes.status).toBe(200);
    expect(listRes.body.pageInfo.total).toBe(0);
    expect(listRes.body.data).toEqual([]);
  };

  const expectGameEntityDeleted = async (gameId: string): Promise<void> => {
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
  };

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

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
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

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    } finally {
      await socketUtils.disconnectAndCleanup(showmanSocket);
    }
  });

  it("should delete game when last user leaves before game start", async () => {
    const setup = await socketUtils.setupGameTestEnvironment(
      userRepo,
      app,
      0,
      0
    );
    const { gameId, showmanSocket } = setup;

    try {
      await socketUtils.leaveGame(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    } finally {
      await socketUtils.disconnectAndCleanup(showmanSocket);
    }
  });

  it("should delete game when last user leaves after game is finished", async () => {
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

      await socketUtils.leaveGame(showmanSocket);

      await expectGameEntityDeleted(gameId);
      await expectGameRemovedFromLobbyIndexes(gameId);
    } finally {
      await socketUtils.disconnectAndCleanup(showmanSocket);
    }
  });
});
