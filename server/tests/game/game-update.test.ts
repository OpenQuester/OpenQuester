import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameEvent, GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { PackageUtils } from "tests/utils/PackageUtils";

describe("Game REST update", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let http: HttpTestClient;
  let utils: SocketGameTestUtils;
  const packageUtils = new PackageUtils();

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    utils = suite.utils;
    http = createHttpTestClient(suite.serverUrl);
  });

  afterAll(async () => {
    await suite?.stop();
  });

  afterEach(async () => {
    await suite?.reset();
  });

  it("should update game and broadcast GameEventDTO to game room", () =>
    suite.scenario(async (scenario) => {
      const userRepo = suite.userRepo;

      const {
        socket: showmanSocket,
        user: showmanUser,
        cookie: showmanCookie
      } = await utils.createGameClient(app, userRepo);

      const { socket: playerSocket, cookie: playerCookie } = await utils.createGameClient(
        app,
        userRepo
      );

      let gameId = "";

      // Create package
      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      // Create game
      const gameRes = await http.post("/v1/games").set("Cookie", showmanCookie).send({
        title: "Update Test Game",
        packageId: packageRes.body.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      // Join game
      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);
      await utils.joinGame(playerSocket, gameId, PlayerRole.PLAYER);

      const eventPromise = scenario.waitForEventMatching<GameEventDTO>(
        playerSocket,
        SocketIOEvents.GAMES,
        (payload) => payload.event === GameEvent.CHANGED && payload.data.id === gameId
      );

      // Update game via REST
      const updateRes = await http.patch(`/v1/games/${gameId}`).set("Cookie", showmanCookie).send({
        title: "Updated Title",
        isPrivate: true,
        password: "MyPass_123",
        ageRestriction: AgeRestriction.A16,
        maxPlayers: 8
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
    }));

  it("should reject package change after game start", () =>
    suite.scenario(async (scenario) => {
      const userRepo = suite.userRepo;

      const {
        socket: showmanSocket,
        user: showmanUser,
        cookie: showmanCookie
      } = await utils.createGameClient(app, userRepo);

      let gameId = "";

      // Create package #1
      const packageData1 = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes1 = await http
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

      const packageRes2 = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData2 });

      expect(packageRes2.status).toBe(200);

      // Create game
      const gameRes = await http.post("/v1/games").set("Cookie", showmanCookie).send({
        title: "Package Change Block Test",
        packageId: packageRes1.body.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      // Start game
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.START, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.START)
      );

      const updateRes = await http.patch(`/v1/games/${gameId}`).set("Cookie", showmanCookie).send({
        packageId: packageRes2.body.id
      });

      expect(updateRes.status).toBe(400);
    }));

  it("should update package data before game start", () =>
    suite.scenario(async () => {
      const userRepo = suite.userRepo;

      const {
        socket: showmanSocket,
        user: showmanUser,
        cookie: showmanCookie
      } = await utils.createGameClient(app, userRepo);

      let gameId = "";

      const packageData1 = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes1 = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData1 });

      expect(packageRes1.status).toBe(200);

      const packageData2 = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        3
      );
      packageData2.title = "Replacement Test Package";

      const packageRes2 = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData2 });

      expect(packageRes2.status).toBe(200);

      const gameRes = await http.post("/v1/games").set("Cookie", showmanCookie).send({
        title: "Package Update Test",
        packageId: packageRes1.body.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      const updateRes = await http.patch(`/v1/games/${gameId}`).set("Cookie", showmanCookie).send({
        packageId: packageRes2.body.id
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.package.id).toBe(packageRes2.body.id);
      expect(updateRes.body.package.title).toBe("Replacement Test Package");
      expect(updateRes.body.package.roundsCount).toBe(2);
      expect(updateRes.body.package.questionsCount).toBe(11);
    }));

  it("should reject setting password for public game", () =>
    suite.scenario(async () => {
      const userRepo = suite.userRepo;

      const {
        socket: showmanSocket,
        user: showmanUser,
        cookie: showmanCookie
      } = await utils.createGameClient(app, userRepo);

      let gameId = "";

      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      const gameRes = await http.post("/v1/games").set("Cookie", showmanCookie).send({
        title: "Public Password Reject",
        packageId: packageRes.body.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      const updateRes = await http.patch(`/v1/games/${gameId}`).set("Cookie", showmanCookie).send({
        password: "SomePass_1"
      });

      expect(updateRes.status).toBe(400);
    }));

  it("should reject removing password for private game", () =>
    suite.scenario(async () => {
      const userRepo = suite.userRepo;

      const {
        socket: showmanSocket,
        user: showmanUser,
        cookie: showmanCookie
      } = await utils.createGameClient(app, userRepo);

      let gameId = "";

      const packageData = packageUtils.createTestPackageData(
        { id: showmanUser.id, username: showmanUser.username },
        false,
        0
      );

      const packageRes = await http
        .post("/v1/packages")
        .set("Cookie", showmanCookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);

      const gameRes = await http.post("/v1/games").set("Cookie", showmanCookie).send({
        title: "Private Password Remove Reject",
        packageId: packageRes.body.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10
      });

      expect(gameRes.status).toBe(200);
      gameId = gameRes.body.id;

      await utils.joinGame(showmanSocket, gameId, PlayerRole.SHOWMAN);

      const updateRes = await http.patch(`/v1/games/${gameId}`).set("Cookie", showmanCookie).send({
        password: null
      });

      expect(updateRes.status).toBe(400);
    }));
});
