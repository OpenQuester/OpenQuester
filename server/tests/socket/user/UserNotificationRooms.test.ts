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

import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOUserEvents } from "domain/enums/SocketIOEvents";
import { UpdateUserInputDTO } from "domain/types/dto/user/UpdateUserInputDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { UserChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("User Notification Rooms Tests", () => {
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
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    await redisClient.del(...(await redisClient.keys("*")));

    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("User Change Notifications During Gameplay", () => {
    it("should notify other players when a player's data changes", async () => {
      // Setup a game with 2 players
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;

      try {
        // Start the game so players are subscribed to each other's notifications
        await utils.startGame(showmanSocket);

        // Set up listeners for user change events on player1's socket
        const userChangePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        // Update player2's username via REST API
        const updateData: UpdateUserInputDTO = {
          username: "UpdatedPlayer2",
        };

        const { cookie: player2Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[1].id
        );

        await request(app)
          .patch(`/v1/users/${playerUsers[1].id}`)
          .set("Cookie", player2Cookie)
          .send(updateData)
          .expect(HttpStatus.OK);

        // Wait for and verify the user change notification
        const receivedEvent = await userChangePromise;
        expect(receivedEvent.userData.username).toBe("UpdatedPlayer2");
        expect(receivedEvent.userData.id).toBe(playerUsers[1].id);

        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });

    it("should not notify players outside the game when user data changes", async () => {
      // Setup two separate games
      const game1Setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      const game2Setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );

      try {
        // Start both games
        await utils.startGame(game1Setup.showmanSocket);
        await utils.startGame(game2Setup.showmanSocket);

        // Set up a promise to ensure no event is received on game1's player
        const noEventPromise = utils.waitForNoEvent(
          game1Setup.playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        // Update game2's player username via REST API
        const updateData: UpdateUserInputDTO = {
          username: "UpdatedGame2Player",
        };

        const { cookie: game2PlayerCookie } = await utils.loginExistingUser(
          app,
          game2Setup.playerUsers[0].id
        );

        await request(app)
          .patch(`/v1/users/${game2Setup.playerUsers[0].id}`)
          .set("Cookie", game2PlayerCookie)
          .send(updateData)
          .expect(HttpStatus.OK);

        // This will resolve successfully if no event is received within the timeout
        // or reject immediately if the unwanted event is received
        await noEventPromise;

        await utils.cleanupGameClients(game1Setup);
        await utils.cleanupGameClients(game2Setup);
      } catch (error) {
        await utils.cleanupGameClients(game1Setup);
        await utils.cleanupGameClients(game2Setup);
        throw error;
      }
    });

    it("should handle multiple players receiving the same user change notification", async () => {
      // Setup a game with 10 players
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Set up listeners for user change events on all player sockets
        const userChangePromises = playerSockets.map((socket) =>
          utils.waitForEvent(socket, SocketIOUserEvents.USER_CHANGE)
        );

        // Update player1's username via REST API
        const updateData: UpdateUserInputDTO = {
          username: "UpdatedPlayer1",
        };

        const { cookie: player1Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[0].id
        );

        await request(app)
          .patch(`/v1/users/${playerUsers[0].id}`)
          .set("Cookie", player1Cookie)
          .send(updateData)
          .expect(HttpStatus.OK);

        // Wait for all notifications and verify
        const receivedEvents = await Promise.all(userChangePromises);

        receivedEvents.forEach((event: UserChangeBroadcastData) => {
          expect(event.userData.username).toBe("UpdatedPlayer1");
          expect(event.userData.id).toBe(playerUsers[0].id);
        });

        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });

    it("should stop notifications when a player leaves the game", async () => {
      // Setup a game with 2 players
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Player1 leaves the game
        await utils.leaveGame(playerSockets[0]);

        // Set up a promise to ensure no event is received by the player who left
        const noEventPromise = utils.waitForNoEvent(
          playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        // Update player2's username via REST API
        const updateData: UpdateUserInputDTO = {
          username: "UpdatedAfterLeave",
        };

        const { cookie: player2Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[1].id
        );

        await request(app)
          .patch(`/v1/users/${playerUsers[1].id}`)
          .set("Cookie", player2Cookie)
          .send(updateData)
          .expect(HttpStatus.OK);

        // This will resolve successfully if no event is received within the timeout
        // or reject immediately if the unwanted event is received
        await noEventPromise;

        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });

    it("should notify new players when they join an existing game", async () => {
      // Setup a game with 1 player initially
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Create a new player and join the existing game
        const { socket: newPlayerSocket } = await utils.createGameClient(
          app,
          userRepo
        );
        await utils.joinSpecificGame(
          newPlayerSocket,
          setup.gameId,
          PlayerRole.PLAYER
        );

        // Set up listener for user change events on the new player's socket
        const userChangePromise = utils.waitForEvent(
          newPlayerSocket,
          SocketIOUserEvents.USER_CHANGE
        );

        // Update the original player's username via REST API
        const updateData: UpdateUserInputDTO = {
          username: "OriginalPlayerUpdated",
        };

        const { cookie: originalPlayerCookie } = await utils.loginExistingUser(
          app,
          playerUsers[0].id
        );

        await request(app)
          .patch(`/v1/users/${playerUsers[0].id}`)
          .set("Cookie", originalPlayerCookie)
          .send(updateData)
          .expect(HttpStatus.OK);

        // Verify the new player receives the notification
        const receivedEvent = await userChangePromise;
        expect(receivedEvent.userData.username).toBe("OriginalPlayerUpdated");
        expect(receivedEvent.userData.id).toBe(playerUsers[0].id);

        // Clean up
        await utils.disconnectAndCleanup(newPlayerSocket);
        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });
  });
});
