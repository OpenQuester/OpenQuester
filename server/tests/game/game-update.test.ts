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

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { GameEvent, GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { PackageUtils } from "tests/utils/PackageUtils";

describe("Game REST update", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;
  const packageUtils = new PackageUtils();

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
    await testEnv.clearRedis();
  });

  it("should update game and broadcast GameEventDTO to game room", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);

    const {
      socket: showmanSocket,
      user: showmanUser,
      cookie: showmanCookie,
    } = await utils.createGameClient(app, userRepo);

    const { socket: playerSocket, cookie: playerCookie } =
      await utils.createGameClient(app, userRepo);

    let gameId = "";

    try {
      // Create package
      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      // Create game
      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", showmanCookie)
        .send({
          title: "Update Test Game",
          packageId: packageRes.body.id,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10,
        });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      // Join game
      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);
      await utils.joinGame(playerSocket, gameId, PlayerRole.PLAYER);

      const eventPromise = new Promise<GameEventDTO>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(new Error("Timed out waiting for game update broadcast")),
          10000
        );

        playerSocket.once(SocketIOEvents.GAMES, (payload: GameEventDTO) => {
          clearTimeout(timeout);
          resolve(payload);
        });
      });

      // Update game via REST
      const updateRes = await request(app)
        .patch(`/v1/games/${gameId}`)
        .set("Cookie", showmanCookie)
        .send({
          title: "Updated Title",
          isPrivate: true,
          password: "MyPass_123",
          ageRestriction: AgeRestriction.A16,
          maxPlayers: 8,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.id).toBe(gameId);
      expect(updateRes.body.title).toBe("Updated Title");
      expect(updateRes.body.isPrivate).toBe(true);
      expect(updateRes.body.ageRestriction).toBe(AgeRestriction.A16);
      expect(updateRes.body.maxPlayers).toBe(8);

      // Ensure game namespace sockets receive event
      const eventPayload = await eventPromise;
      expect(eventPayload.event).toBe(GameEvent.CHANGED);
      expect(eventPayload.data.id).toBe(gameId);
      expect(eventPayload.data.title).toBe("Updated Title");
      expect(eventPayload.data.isPrivate).toBe(true);

      // Sanity: player cookie is unused here, keep it to ensure auth isolation
      expect(playerCookie).toBeDefined();
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);
      await utils.disconnectAndCleanup(playerSocket);

      if (gameId) {
        // Best-effort cleanup; game may already be expired in Redis in some cases
        await request(app)
          .delete(`/v1/games/${gameId}`)
          .set("Cookie", showmanCookie);
      }
    }
  });

  it("should reject package change after game start", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);

    const {
      socket: showmanSocket,
      user: showmanUser,
      cookie: showmanCookie,
    } = await utils.createGameClient(app, userRepo);

    let gameId = "";

    try {
      // Create package #1
      const packageData1 = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes1 = await request(app)
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData1 });

      expect(packageRes1.status).toBe(200);

      // Create package #2
      const packageData2 = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        1
      );

      const packageRes2 = await request(app)
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData2 });

      expect(packageRes2.status).toBe(200);

      // Create game
      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", showmanCookie)
        .send({
          title: "Package Change Block Test",
          packageId: packageRes1.body.id,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10,
        });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      // Start game
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.START, () => resolve());
        showmanSocket.emit(SocketIOGameEvents.START);
      });

      const updateRes = await request(app)
        .patch(`/v1/games/${gameId}`)
        .set("Cookie", showmanCookie)
        .send({
          packageId: packageRes2.body.id,
        });

      expect(updateRes.status).toBe(400);
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);

      if (gameId) {
        await request(app)
          .delete(`/v1/games/${gameId}`)
          .set("Cookie", showmanCookie);
      }
    }
  });

  it("should reject setting password for public game", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);

    const {
      socket: showmanSocket,
      user: showmanUser,
      cookie: showmanCookie,
    } = await utils.createGameClient(app, userRepo);

    let gameId = "";

    try {
      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", showmanCookie)
        .send({
          title: "Public Password Reject",
          packageId: packageRes.body.id,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10,
        });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      const updateRes = await request(app)
        .patch(`/v1/games/${gameId}`)
        .set("Cookie", showmanCookie)
        .send({
          password: "SomePass_1",
        });

      expect(updateRes.status).toBe(400);
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);

      if (gameId) {
        await request(app)
          .delete(`/v1/games/${gameId}`)
          .set("Cookie", showmanCookie);
      }
    }
  });

  it("should reject removing password for private game", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);

    const {
      socket: showmanSocket,
      user: showmanUser,
      cookie: showmanCookie,
    } = await utils.createGameClient(app, userRepo);

    let gameId = "";

    try {
      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", showmanCookie)
        .send({
          title: "Private Password Remove Reject",
          packageId: packageRes.body.id,
          isPrivate: true,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10,
        });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      const updateRes = await request(app)
        .patch(`/v1/games/${gameId}`)
        .set("Cookie", showmanCookie)
        .send({
          password: null,
        });

      expect(updateRes.status).toBe(400);
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);

      if (gameId) {
        await request(app)
          .delete(`/v1/games/${gameId}`)
          .set("Cookie", showmanCookie);
      }
    }
  });
});
