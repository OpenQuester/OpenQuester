import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import {
  GameLeaveBroadcastData,
  PlayerKickBroadcastData,
  PlayerRestrictionBroadcastData,
  PlayerRoleChangeBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { container } from "tsyringe";

describe("PlayerRestrictions", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;
  let playerGameStatsRepository: PlayerGameStatsRepository;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;

    playerGameStatsRepository = container.resolve(PlayerGameStatsRepository);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("should prevent restricted player from joining as PLAYER or SHOWMAN, allow only SPECTATOR", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      // Get a player to restrict
      const targetPlayerId = setup.playerUsers[0].id;

      // Showman restricts the player
      const restrictionEventPromise = scenario.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );

      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false
      });

      await restrictionEventPromise;

      // Player leaves
      await utils.leaveGame(setup.playerSockets[0]);

      // Create a new socket for the restricted player to test joining
      const { cookie } = await utils.loginExistingUser(app, targetPlayerId);
      const restrictedSocket = await utils.createUnauthenticatedGameClient();

      // Authenticate the socket manually
      await (async () => {
        const authRes = await createHttpTestClient(suite.serverUrl)
          .post("/v1/auth/socket")
          .set("Cookie", cookie)
          .send({ socketId: restrictedSocket.id });

        if (authRes.status !== 200) {
          throw new Error(`Failed to authenticate socket: ${JSON.stringify(authRes.body)}`);
        }
      })();

      const playerJoinError = await utils.joinGameWithPasswordExpectError(
        restrictedSocket,
        setup.gameId,
        PlayerRole.PLAYER
      );
      expect(playerJoinError.message).toBe(
        "You are restricted from this game and can only join as spectator"
      );

      const showmanJoinError = await utils.joinGameWithPasswordExpectError(
        restrictedSocket,
        setup.gameId,
        PlayerRole.SHOWMAN
      );
      expect(showmanJoinError.message).toBe(
        "You are restricted from this game and can only join as spectator"
      );

      // Should succeed to join as SPECTATOR
      const joinEventPromise = scenario.waitForEvent(setup.showmanSocket, SocketIOGameEvents.JOIN);

      scenario.actor(restrictedSocket).emit(SocketIOGameEvents.JOIN, {
        gameId: setup.gameId,
        role: PlayerRole.SPECTATOR
      });

      const joinData = await joinEventPromise;
      expect(joinData.role).toBe(PlayerRole.SPECTATOR);
    });
  });

  it("should broadcast role change and persist spectator role when restricting a player", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);

      const targetPlayerId = setup.playerUsers[0].id;
      const targetPlayerSocket = setup.playerSockets[0];
      const spectatorSocket = setup.spectatorSockets[0];

      const restrictionEventPromise = scenario.waitForEvent<PlayerRestrictionBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );
      const showmanRoleChangePromise = scenario.waitForEvent<PlayerRoleChangeBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE
      );
      const targetRoleChangePromise = scenario.waitForEvent<PlayerRoleChangeBroadcastData>(
        targetPlayerSocket,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE
      );
      const spectatorRoleChangePromise = scenario.waitForEvent<PlayerRoleChangeBroadcastData>(
        spectatorSocket,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE
      );

      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false
      });

      const [restrictionData, showmanRoleChange, targetRoleChange, spectatorRoleChange] =
        await Promise.all([
          restrictionEventPromise,
          showmanRoleChangePromise,
          targetRoleChangePromise,
          spectatorRoleChangePromise
        ]);

      expect(restrictionData).toMatchObject({
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false
      });

      for (const roleChangeData of [showmanRoleChange, targetRoleChange, spectatorRoleChange]) {
        expect(roleChangeData.playerId).toBe(targetPlayerId);
        expect(roleChangeData.newRole).toBe(PlayerRole.SPECTATOR);
        expect(roleChangeData.players).toContainEqual(
          expect.objectContaining({
            meta: expect.objectContaining({ id: targetPlayerId }),
            role: PlayerRole.SPECTATOR,
            slot: null,
            restrictionData: expect.objectContaining({ restricted: true })
          })
        );
      }

      await scenario.waitForNoEvent(setup.showmanSocket, SocketIOGameEvents.LEAVE);

      const game = await utils.getGameFromGameService(setup.gameId);
      const restrictedPlayer = game.getPlayer(targetPlayerId, {
        fetchDisconnected: true
      });

      expect(restrictedPlayer).toBeDefined();
      expect(restrictedPlayer!.role).toBe(PlayerRole.SPECTATOR);
      expect(restrictedPlayer!.gameSlot).toBeNull();
      expect(restrictedPlayer!.isRestricted).toBe(true);
      expect(targetPlayerSocket.connected).toBe(true);
    });
  });

  it("should prevent banned player from joining in any role", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      // Get a player to ban
      const targetPlayerId = setup.playerUsers[0].id;

      // Wait for both PLAYER_RESTRICTED and LEAVE events when banning
      const restrictionEventPromise = scenario.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );
      const leaveEventPromise = scenario.waitForEvent<GameLeaveBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.LEAVE
      );

      // Showman bans the player
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: false,
        banned: true
      });

      // Wait for both events
      await restrictionEventPromise;
      const leaveData = await leaveEventPromise;
      expect(leaveData.user).toBe(targetPlayerId);

      // Create a new socket for the banned player to test joining
      const { cookie } = await utils.loginExistingUser(app, targetPlayerId);
      const bannedSocket = await utils.createUnauthenticatedGameClient();

      // Authenticate the socket manually
      await (async () => {
        const authRes = await createHttpTestClient(suite.serverUrl)
          .post("/v1/auth/socket")
          .set("Cookie", cookie)
          .send({ socketId: bannedSocket.id });

        if (authRes.status !== 200) {
          throw new Error(`Failed to authenticate socket: ${JSON.stringify(authRes.body)}`);
        }
      })();

      const playerJoinError = await utils.joinGameWithPasswordExpectError(
        bannedSocket,
        setup.gameId,
        PlayerRole.PLAYER
      );
      expect(playerJoinError.message).toBe("You are banned in this game!");

      const showmanJoinError = await utils.joinGameWithPasswordExpectError(
        bannedSocket,
        setup.gameId,
        PlayerRole.SHOWMAN
      );
      expect(showmanJoinError.message).toBe("You are banned in this game!");

      const spectatorJoinError = await utils.joinGameWithPasswordExpectError(
        bannedSocket,
        setup.gameId,
        PlayerRole.SPECTATOR
      );
      expect(spectatorJoinError.message).toBe("You are banned in this game!");
    });
  });

  it("should force-disconnect banned player after restriction and leave broadcasts", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);

      const targetPlayerId = setup.playerUsers[0].id;
      const bannedPlayerSocket = setup.playerSockets[0];

      const restrictionEventPromise = scenario.waitForEvent<PlayerRestrictionBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );
      const leaveEventPromise = scenario.waitForEvent<GameLeaveBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.LEAVE
      );
      const disconnectPromise = scenario.waitForEvent(bannedPlayerSocket, "disconnect");

      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: false,
        banned: true
      });

      const [restrictionData, leaveData] = await Promise.all([
        restrictionEventPromise,
        leaveEventPromise,
        disconnectPromise
      ]);

      expect(restrictionData).toMatchObject({
        playerId: targetPlayerId,
        muted: false,
        restricted: false,
        banned: true
      });
      expect(leaveData.user).toBe(targetPlayerId);
      expect(bannedPlayerSocket.connected).toBe(false);

      const game = await utils.getGameFromGameService(setup.gameId);
      const bannedPlayer = game.getPlayer(targetPlayerId, {
        fetchDisconnected: true
      });

      expect(bannedPlayer).toBeDefined();
      expect(bannedPlayer!.isBanned).toBe(true);
    });
  });

  it("should successfully kick a player and emit LEAVE event", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      // Get the player to kick
      const targetPlayerId = setup.playerUsers[0].id;
      const playerSocket = setup.playerSockets[0];

      const kickEventPromise = scenario.waitForEvent<PlayerKickBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_KICKED
      );

      const leaveEventPromise = scenario.waitForEvent<GameLeaveEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.LEAVE
      );

      const playerLeaveEventPromise = scenario.waitForEvent<GameLeaveEventPayload>(
        playerSocket,
        SocketIOGameEvents.LEAVE
      );

      // Showman kicks the player
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_KICKED, {
        playerId: targetPlayerId
      });

      // Wait for all events to be received
      const [kickData, leaveData, playerLeaveData] = await Promise.all([
        kickEventPromise,
        leaveEventPromise,
        playerLeaveEventPromise
      ]);

      // Verify event data
      expect(kickData.playerId).toBe(targetPlayerId);
      expect(leaveData.user).toBe(targetPlayerId);
      expect(playerLeaveData.user).toBe(targetPlayerId);
    });
  });

  it("should end player session in Redis when restricting a player", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      const targetPlayerId = setup.playerUsers[0].id;
      const gameId = setup.gameId;

      // Verify initial session has no leftAt timestamp
      const initialSessionData = await playerGameStatsRepository.getStats(gameId, targetPlayerId);
      expect(initialSessionData).toBeTruthy();
      expect(initialSessionData!.leftAt).toBe("");

      // Wait for PLAYER_RESTRICTED event
      const restrictionEventPromise = scenario.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );

      // Showman restricts the player (should end their session)
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false
      });

      await restrictionEventPromise;

      // Verify session now has leftAt timestamp (session was ended)
      const finalSessionData = await playerGameStatsRepository.getStats(gameId, targetPlayerId);
      expect(finalSessionData).toBeTruthy();
      expect(finalSessionData!.leftAt).not.toBe("");

      // Verify leftAt is a recent timestamp
      const leftAt = new Date(finalSessionData!.leftAt);
      const now = new Date();
      const timeDiff = now.getTime() - leftAt.getTime();
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });
  });

  it("should allow showman to kick themselves - treated same as leave", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const showmanSocket = setup.showmanSocket;
      const showmanId = setup.showmanUser.id;

      const kickEventPromise = scenario.waitForEvent<PlayerKickBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.PLAYER_KICKED
      );

      // Showman kicks themselves
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_KICKED, {
        playerId: showmanId
      });

      // Showman CAN kick themselves - it's treated like a leave
      const kickData = await kickEventPromise;
      expect(kickData.playerId).toBe(showmanId);
    });
  });
});
