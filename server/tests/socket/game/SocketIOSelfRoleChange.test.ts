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

import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerRoleChangeBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Socket IO Self Role Change", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let userRepo: Repository<User>;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new SocketGameTestUtils(serverUrl);
    userRepo = testEnv.getDatabase().getRepository(User);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Self Role Changes in Lobby", () => {
    it("should allow player to change to spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      try {
        const playerUserId = setup.playerUsers[0].id;
        const newRole = PlayerRole.SPECTATOR;

        // Wait for PLAYER_ROLE_CHANGE event
        const roleChangeEventPromise =
          utils.waitForEvent<PlayerRoleChangeBroadcastData>(
            setup.playerSockets[0],
            SocketIOGameEvents.PLAYER_ROLE_CHANGE
          );

        // Player changes their own role
        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole,
        });

        // Wait for event to be received
        const roleData = await roleChangeEventPromise;

        // Verify event data
        expect(roleData.playerId).toBe(playerUserId);
        expect(roleData.newRole).toBe(newRole);
        expect(roleData.players).toBeDefined();
        expect(Array.isArray(roleData.players)).toBe(true);

        // Verify player role was actually changed
        const updatedPlayer = roleData.players.find(
          (p: PlayerDTO) => p.meta.id === playerUserId
        );
        expect(updatedPlayer).toBeDefined();
        expect(updatedPlayer!.role).toBe(PlayerRole.SPECTATOR);
        expect(updatedPlayer!.slot).toBeNull(); // Spectators don't have slots
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow showman to step down to player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const showmanUserId = setup.showmanUser.id;
        const newRole = PlayerRole.PLAYER;

        // Wait for PLAYER_ROLE_CHANGE event
        const roleChangeEventPromise =
          utils.waitForEvent<PlayerRoleChangeBroadcastData>(
            setup.showmanSocket,
            SocketIOGameEvents.PLAYER_ROLE_CHANGE
          );

        // Showman changes to player
        setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: showmanUserId,
          newRole,
        });

        // Wait for event to be received
        const roleData = await roleChangeEventPromise;

        // Verify event data
        expect(roleData.playerId).toBe(showmanUserId);
        expect(roleData.newRole).toBe(PlayerRole.PLAYER);

        // Verify showman role was changed and assigned a slot
        const updatedPlayer = roleData.players.find(
          (p: PlayerDTO) => p.meta.id === showmanUserId
        );
        expect(updatedPlayer).toBeDefined();
        expect(updatedPlayer!.role).toBe(PlayerRole.PLAYER);
        expect(updatedPlayer!.slot).not.toBeNull(); // New player gets assigned a slot

        // Verify no showman exists anymore (slot is now open)
        const showmanExists = roleData.players.some(
          (p: PlayerDTO) => p.role === PlayerRole.SHOWMAN
        );
        expect(showmanExists).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Self Role Change Restrictions", () => {
    it("should prevent changing to same role", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const playerUserId = setup.playerUsers[0].id;
        const currentRole = PlayerRole.PLAYER; // Same as current role

        // Wait for error event
        const errorPromise = utils.waitForEvent(
          setup.playerSockets[0],
          SocketIOEvents.ERROR,
          2000
        );

        // Try to change to same role (should fail)
        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole: currentRole,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Invalid role change");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should prevent taking showman role when already taken", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const playerUserId = setup.playerUsers[0].id;
        const newRole = PlayerRole.SHOWMAN;

        // Wait for error event
        const errorPromise = utils.waitForEvent(
          setup.playerSockets[0],
          SocketIOEvents.ERROR,
          2000
        );

        // Try to become showman when slot is taken (should fail)
        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Showman slot is already taken");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should prevent non-self role changes", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      try {
        const targetPlayerId = setup.playerUsers[1].id;
        const newRole = PlayerRole.SPECTATOR;

        // Wait for error event
        const errorPromise = utils.waitForEvent(
          setup.playerSockets[0],
          SocketIOEvents.ERROR,
          2000
        );

        // Try to change another player's role from non-showman (should fail)
        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: targetPlayerId,
          newRole,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Only showman can manage players");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Backward Compatibility", () => {
    it("should allow showman to change player's role", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      try {
        const playerUserId = setup.playerUsers[0].id;
        const newRole = PlayerRole.SPECTATOR;

        // Wait for PLAYER_ROLE_CHANGE event
        const roleChangeEventPromise =
          utils.waitForEvent<PlayerRoleChangeBroadcastData>(
            setup.showmanSocket,
            SocketIOGameEvents.PLAYER_ROLE_CHANGE
          );

        // Showman changes another player's role
        setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole,
        });

        // Wait for event to be received
        const roleData = await roleChangeEventPromise;

        // Verify event data
        expect(roleData.playerId).toBe(playerUserId);
        expect(roleData.newRole).toBe(newRole);

        // Verify player role was actually changed
        const updatedPlayer = roleData.players.find(
          (p: PlayerDTO) => p.meta.id === playerUserId
        );
        expect(updatedPlayer).toBeDefined();
        expect(updatedPlayer!.role).toBe(PlayerRole.SPECTATOR);
        expect(updatedPlayer!.slot).toBeNull(); // Spectators don't have slots
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Mid-Game Role Changes", () => {
    it("should allow self role changes during mid-game (not answering)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;

      try {
        // Start the game first
        const gameStartPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.START
        );

        showmanSocket.emit(SocketIOGameEvents.START, {});
        await gameStartPromise;

        const playerUserId = playerUsers[0].id;
        const newRole = PlayerRole.SPECTATOR;

        // Wait for PLAYER_ROLE_CHANGE event
        const roleChangeEventPromise =
          utils.waitForEvent<PlayerRoleChangeBroadcastData>(
            playerSockets[0],
            SocketIOGameEvents.PLAYER_ROLE_CHANGE
          );

        // Player changes their own role during mid-game
        playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          newRole,
        });

        // Wait for event to be received
        const roleData = await roleChangeEventPromise;

        // Verify the change happened
        expect(roleData.playerId).toBe(playerUserId);
        expect(roleData.newRole).toBe(newRole);

        const updatedPlayer = roleData.players.find(
          (p: PlayerDTO) => p.meta.id === playerUserId
        );
        expect(updatedPlayer!.role).toBe(PlayerRole.SPECTATOR);
        expect(updatedPlayer!.slot).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should prevent self role changes during question answering", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);
        // Pick a question to enter answering state
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Have a player answer the question to enter ANSWERING state
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const playerUserId = playerUsers[0].id;

        // Wait for error event - role changes should be blocked during answering
        const errorPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOEvents.ERROR,
          2000
        );

        // Try to change role during answering (should fail)
        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole: PlayerRole.SPECTATOR,
        });

        const error = await errorPromise;
        expect(error.message).toContain("Cannot change role while answering");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
