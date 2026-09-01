import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { NotificationType } from "domain/enums/NotificationType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { NotificationBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TestUtils } from "tests/utils/TestUtils";

describe("Game expiration notifications", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let socketUtils: SocketGameTestUtils;
  let testUtils: TestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    socketUtils = suite.utils;
    testUtils = suite.testUtils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("should emit notification when game is about to expire", async () => {
    const setup = await socketUtils.setupGameTestEnvironment(userRepo, app, 1, 0);
    const { showmanSocket, gameId } = setup;

    const notificationPromise = socketUtils.waitForEvent<NotificationBroadcastData>(
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
  });
});
