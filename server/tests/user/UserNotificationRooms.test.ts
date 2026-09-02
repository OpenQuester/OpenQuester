import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { Repository } from "typeorm";

import { UpdateUserInputDTO } from "application/types/user/UpdateUserInputDTO";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOUserEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { UserChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

describe("User Notification Rooms Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let http: HttpTestClient;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    utils = suite.utils;
    userRepo = suite.userRepo;
    http = createHttpTestClient(suite.serverUrl);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("User Change Notifications During Gameplay", () => {
    it("should notify other players when a player updates themself (/v1/me)", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, playerUsers } = setup;

        await utils.startGame(showmanSocket);

        const userChangePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = { username: "updatedself" };
        const { cookie: player2Cookie } = await utils.loginExistingUser(app, playerUsers[1].id);

        await http
          .patch("/v1/me")
          .set("Cookie", player2Cookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        const receivedEvent = await userChangePromise;
        expect(receivedEvent.userData.username).toBe("updatedself");
        expect(receivedEvent.userData.id).toBe(playerUsers[1].id);
      }));

    it("should not notify players in a different game when a user updates themself", () =>
      suite.scenario(async (scenario) => {
        const game1Setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const game2Setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

        await utils.startGame(game1Setup.showmanSocket);
        await utils.startGame(game2Setup.showmanSocket);

        const updateData: UpdateUserInputDTO = { username: "updatedingame2" };
        const { cookie: game2PlayerCookie } = await utils.loginExistingUser(
          app,
          game2Setup.playerUsers[0].id
        );
        const beforeUpdate = scenario.mark();

        await http
          .patch("/v1/me")
          .set("Cookie", game2PlayerCookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        await scenario.assert.noInbound({
          actor: scenario.actor(game1Setup.playerSockets[0]),
          event: SocketIOUserEvents.USER_CHANGE,
          afterSequence: beforeUpdate,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
          description: "a profile update must remain isolated from the other game"
        });
      }));

    it(
      "should broadcast a self-update to all other players in a large game",
      () =>
        suite.scenario(async (scenario) => {
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 10, 0);
          const { showmanSocket, playerSockets, playerUsers } = setup;

          await utils.startGame(showmanSocket);

          const userChangePromises = playerSockets.map((socket, idx) =>
            idx === 0
              ? Promise.resolve(undefined)
              : scenario.waitForEvent(socket, SocketIOUserEvents.USER_CHANGE)
          );

          const updateData: UpdateUserInputDTO = { username: "updatedmass" };
          const { cookie: player1Cookie } = await utils.loginExistingUser(app, playerUsers[0].id);

          await http
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
        }),
      20000
    );

    it("should stop receiving updates after a player leaves the game", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        await utils.leaveGame(playerSockets[0]);

        const updateData: UpdateUserInputDTO = {
          username: "updatedafterleave"
        };

        const { cookie: player2Cookie } = await utils.loginExistingUser(app, playerUsers[1].id);
        const beforeUpdate = scenario.mark();

        await http
          .patch("/v1/me")
          .set("Cookie", player2Cookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        await scenario.assert.noInbound({
          actor: scenario.actor(playerSockets[0]),
          event: SocketIOUserEvents.USER_CHANGE,
          afterSequence: beforeUpdate,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS,
          description: "a departed player must not receive later profile updates"
        });
      }));

    it("should notify late joiners of future self-updates of existing players", () =>
      suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerUsers } = setup;

        await utils.startGame(showmanSocket);

        const { socket: newPlayerSocket } = await utils.createGameClient(app, userRepo);

        await utils.joinSpecificGame(newPlayerSocket, setup.gameId, PlayerRole.PLAYER);

        const userChangePromise = scenario.waitForEvent(
          newPlayerSocket,
          SocketIOUserEvents.USER_CHANGE
        );

        const updateData: UpdateUserInputDTO = {
          username: "originalplayerupdated"
        };

        const { cookie: originalPlayerCookie } = await utils.loginExistingUser(
          app,
          playerUsers[0].id
        );

        await http
          .patch("/v1/me")
          .set("Cookie", originalPlayerCookie[0])
          .send(updateData)
          .expect(HttpStatus.OK);

        const receivedEvent = await userChangePromise;

        expect(receivedEvent.userData.username).toBe("originalplayerupdated");
        expect(receivedEvent.userData.id).toBe(playerUsers[0].id);
        await utils.disconnectAndCleanup(newPlayerSocket);
      }));
  });
});
