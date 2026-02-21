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

import { NotificationType } from "domain/enums/NotificationType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { NotificationBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

describe("Game expiration notifications", () => {
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

  it("should emit notification when game is about to expire", async () => {
    const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 1, 0);
    const { showmanSocket, gameId } = setup;

    try {
      const notificationPromise =
        socketUtils.waitForEvent<NotificationBroadcastData>(
          showmanSocket,
          SocketIOEvents.NOTIFICATIONS,
          1000
        );

      await testUtils.expireGameExpirationWarning(gameId);

      const notification = await notificationPromise;
      expect(notification.type).toBe(NotificationType.GAME_EXPIRATION_WARNING);
      expect(notification.data.gameId).toBe(gameId);

      const expiresAt = new Date(notification.data.expiresAt);
      expect(Number.isNaN(expiresAt.getTime())).toBe(false);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    } finally {
      await socketUtils.cleanupGameClients(setup);
    }
  });
});
