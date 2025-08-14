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
    // Use default test port (3000) as in other socket tests
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
    const keys = await redisClient.keys("*");
    if (keys.length > 0) await redisClient.del(...keys);
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
    it("should notify other players when a player updates themself (/v1/me)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;
      try {
        await utils.startGame(showmanSocket);

        const userChangePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = { username: "updatedself" };
        const { cookie: player2Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[1].id
        );

        await request(app)
          .patch("/v1/me")
          .set("Cookie", player2Cookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        const receivedEvent = await userChangePromise;
        expect(receivedEvent.userData.username).toBe("updatedself");
        expect(receivedEvent.userData.id).toBe(playerUsers[1].id);

        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });

    it("should not notify players in a different game when a user updates themself", async () => {
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
        await utils.startGame(game1Setup.showmanSocket);
        await utils.startGame(game2Setup.showmanSocket);

        const noEventPromise = utils.waitForNoEvent(
          game1Setup.playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = { username: "updatedingame2" };
        const { cookie: game2PlayerCookie } = await utils.loginExistingUser(
          app,
          game2Setup.playerUsers[0].id
        );

        await request(app)
          .patch("/v1/me")
          .set("Cookie", game2PlayerCookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        await noEventPromise;

        await utils.cleanupGameClients(game1Setup);
        await utils.cleanupGameClients(game2Setup);
      } catch (error) {
        await utils.cleanupGameClients(game1Setup);
        await utils.cleanupGameClients(game2Setup);
        throw error;
      }
    });

    it("should broadcast a self-update to all other players in a large game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;
      try {
        await utils.startGame(showmanSocket);

        const userChangePromises = playerSockets.map((socket, idx) =>
          idx === 0
            ? Promise.resolve(undefined)
            : utils.waitForEvent(socket, SocketIOUserEvents.USER_CHANGE)
        );

        const updateData: UpdateUserInputDTO = { username: "updatedmass" };
        const { cookie: player1Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[0].id
        );

        await request(app)
          .patch("/v1/me")
          .set("Cookie", player1Cookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        const receivedEvents = (await Promise.all(userChangePromises)).filter(
          Boolean
        ) as UserChangeBroadcastData[];

        receivedEvents.forEach((event: UserChangeBroadcastData) => {
          expect(event.userData.username).toBe("updatedmass");
          expect(event.userData.id).toBe(playerUsers[0].id);
        });
        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    }, 20000);

    it("should stop receiving updates after a player leaves the game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;
      try {
        await utils.startGame(showmanSocket);
        await utils.leaveGame(playerSockets[0]);

        const noEventPromise = utils.waitForNoEvent(
          playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = {
          username: "updatedafterleave",
        };

        const { cookie: player2Cookie } = await utils.loginExistingUser(
          app,
          playerUsers[1].id
        );

        await request(app)
          .patch("/v1/me")
          .set("Cookie", player2Cookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        await noEventPromise;
        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });

    it("should notify late joiners of future self-updates of existing players", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerUsers } = setup;
      try {
        await utils.startGame(showmanSocket);

        const { socket: newPlayerSocket } = await utils.createGameClient(
          app,
          userRepo
        );

        await utils.joinSpecificGame(
          newPlayerSocket,
          setup.gameId,
          PlayerRole.PLAYER
        );

        const userChangePromise = utils.waitForEvent(
          newPlayerSocket,
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = {
          username: "originalplayerupdated",
        };

        const { cookie: originalPlayerCookie } = await utils.loginExistingUser(
          app,
          playerUsers[0].id
        );

        await request(app)
          .patch("/v1/me")
          .set("Cookie", originalPlayerCookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        const receivedEvent = await userChangePromise;

        expect(receivedEvent.userData.username).toBe("originalplayerupdated");
        expect(receivedEvent.userData.id).toBe(playerUsers[0].id);
        await utils.disconnectAndCleanup(newPlayerSocket);
        await utils.cleanupGameClients(setup);
      } catch (error) {
        await utils.cleanupGameClients(setup);
        throw error;
      }
    });
  });
});
