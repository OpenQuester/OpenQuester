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

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { PackageUtils } from "tests/utils/PackageUtils";

describe("PrivateGamePassword", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;
  let packageUtils: PackageUtils;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
    packageUtils = new PackageUtils();
    userRepo = testEnv.getDatabase().getRepository(User);
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

  it("should auto-generate a 4-character password for private game without password", async () => {
    const { socket, user, cookie } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create private game without password
      const gameData: GameCreateDTO = {
        title: "Private Game Test",
        packageId: createdPackage.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Join the game to access gameState
      const gameDataReceived = await utils.joinSpecificGameWithData(
        socket,
        gameId,
        PlayerRole.SHOWMAN
      );

      // Verify password was auto-generated
      expect(gameDataReceived.gameState.password).toBeDefined();
      expect(gameDataReceived.gameState.password).toHaveLength(4);
      expect(gameDataReceived.gameState.password).toMatch(/^[A-Z]+$/);

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      socket.disconnect();
    }
  });

  it("should use custom password for private game when provided", async () => {
    const { socket, user, cookie } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create private game with custom password
      const customPassword = "Pass_123-Xyz";
      const gameData: GameCreateDTO = {
        title: "Private Game Test",
        packageId: createdPackage.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: customPassword,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Join the game to access gameState
      const gameDataReceived = await utils.joinSpecificGameWithData(
        socket,
        gameId,
        PlayerRole.SHOWMAN
      );

      // Verify custom password is used
      expect(gameDataReceived.gameState.password).toBe(customPassword);

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      socket.disconnect();
    }
  });

  it("should not set password for non-private games", async () => {
    const { socket, user, cookie } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create non-private game
      const gameData: GameCreateDTO = {
        title: "Public Game Test",
        packageId: createdPackage.id,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Join the game to access gameState
      const gameDataReceived = await utils.joinSpecificGameWithData(
        socket,
        gameId,
        PlayerRole.SHOWMAN
      );

      // Verify password is not set for public games
      expect(gameDataReceived.gameState.password).toBeNull();

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      socket.disconnect();
    }
  });

  it("should reject password with invalid characters", async () => {
    const username = `testuser_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const { user, cookie } = await utils.createAndLoginUser(
      userRepo,
      app,
      username
    );

    // Create a test package
    const packageData = packageUtils.createTestPackageData(
      {
        id: user.id,
        username: user.username,
      },
      false,
      0
    );

    const packageRes = await request(app)
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageData });

    expect(packageRes.status).toBe(200);
    const createdPackage = packageRes.body;

    // Try to create game with invalid password (contains emoji/special chars)
    const gameData: GameCreateDTO = {
      title: "Private Game Test",
      packageId: createdPackage.id,
      isPrivate: true,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 10,
      password: "Pass🎮123",
    };

    const gameRes = await request(app)
      .post("/v1/games")
      .set("Cookie", cookie)
      .send(gameData);

    // Should return validation error
    expect(gameRes.status).toBe(400);
  });

  it("should reject password longer than 16 characters", async () => {
    const username = `testuser_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const { user, cookie } = await utils.createAndLoginUser(
      userRepo,
      app,
      username
    );

    // Create a test package
    const packageData = packageUtils.createTestPackageData(
      {
        id: user.id,
        username: user.username,
      },
      false,
      0
    );

    const packageRes = await request(app)
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageData });

    expect(packageRes.status).toBe(200);
    const createdPackage = packageRes.body;

    // Try to create game with too long password
    const gameData: GameCreateDTO = {
      title: "Private Game Test",
      packageId: createdPackage.id,
      isPrivate: true,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 10,
      password: "ThisPasswordIsTooLong",
    };

    const gameRes = await request(app)
      .post("/v1/games")
      .set("Cookie", cookie)
      .send(gameData);

    // Should return validation error
    expect(gameRes.status).toBe(400);
  });

  it("should allow joining private game with correct password", async () => {
    const {
      socket: hostSocket,
      user,
      cookie,
    } = await utils.createGameClient(app, userRepo);
    const { socket: playerSocket } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create private game with custom password
      const customPassword = "Test123";
      const gameData: GameCreateDTO = {
        title: "Private Game Test",
        packageId: createdPackage.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: customPassword,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Host joins first
      await utils.joinSpecificGameWithData(
        hostSocket,
        gameId,
        PlayerRole.SHOWMAN,
        customPassword
      );

      // Player joins with correct password
      const gameDataReceived = await utils.joinSpecificGameWithData(
        playerSocket,
        gameId,
        PlayerRole.PLAYER,
        customPassword
      );

      // Verify join was successful
      expect(gameDataReceived).toBeDefined();
      expect(gameDataReceived.gameState.password).toBe(customPassword);

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      hostSocket.disconnect();
      playerSocket.disconnect();
    }
  });

  it("should reject joining private game with incorrect password", async () => {
    const {
      socket: hostSocket,
      user,
      cookie,
    } = await utils.createGameClient(app, userRepo);
    const { socket: playerSocket } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create private game with custom password
      const customPassword = "Test123";
      const gameData: GameCreateDTO = {
        title: "Private Game Test",
        packageId: createdPackage.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: customPassword,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Host joins first
      await utils.joinSpecificGameWithData(
        hostSocket,
        gameId,
        PlayerRole.SHOWMAN,
        customPassword
      );

      // Player tries to join with incorrect password
      const errorResult = await utils.joinGameWithPasswordExpectError(
        playerSocket,
        gameId,
        PlayerRole.PLAYER,
        "WrongPass"
      );

      // Verify error was received
      expect(errorResult).toBeDefined();
      expect(errorResult.message.toLowerCase()).toContain("incorrect");
      expect(errorResult.message.toLowerCase()).toContain("password");

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      hostSocket.disconnect();
      playerSocket.disconnect();
    }
  });

  it("should reject joining private game without password", async () => {
    const {
      socket: hostSocket,
      user,
      cookie,
    } = await utils.createGameClient(app, userRepo);
    const { socket: playerSocket } = await utils.createGameClient(
      app,
      userRepo
    );

    try {
      // Create a test package
      const packageData = packageUtils.createTestPackageData(
        {
          id: user.id,
          username: user.username,
        },
        false,
        0
      );

      const packageRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookie)
        .send({ content: packageData });

      expect(packageRes.status).toBe(200);
      const createdPackage = packageRes.body;

      // Create private game with custom password
      const customPassword = "Test123";
      const gameData: GameCreateDTO = {
        title: "Private Game Test",
        packageId: createdPackage.id,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: customPassword,
      };

      const gameRes = await request(app)
        .post("/v1/games")
        .set("Cookie", cookie)
        .send(gameData);

      expect(gameRes.status).toBe(200);
      const createdGame = gameRes.body;
      const gameId = createdGame.id;

      // Host joins first
      await utils.joinSpecificGameWithData(
        hostSocket,
        gameId,
        PlayerRole.SHOWMAN,
        customPassword
      );

      // Player tries to join without password
      const errorResult = await utils.joinGameWithPasswordExpectError(
        playerSocket,
        gameId,
        PlayerRole.PLAYER
      );

      // Verify error was received
      expect(errorResult).toBeDefined();
      expect(errorResult.message.toLowerCase()).toContain("incorrect");
      expect(errorResult.message.toLowerCase()).toContain("password");

      // Clean up
      await utils.deleteGame(app, gameId, [cookie]);
    } finally {
      hostSocket.disconnect();
      playerSocket.disconnect();
    }
  });
});
