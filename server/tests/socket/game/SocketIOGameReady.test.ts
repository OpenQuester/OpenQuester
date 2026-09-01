import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  type GameStartBroadcastData,
  type PlayerReadinessBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("SocketIOGameReady", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Player Ready Functionality", () => {
    it("should allow player to set ready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      // Listen for ready event on showman socket
      const readyEventPromise = utils.waitForPlayerReady(showmanSocket);

      // Player sets ready
      await utils.setPlayerReady(playerSockets[0]);

      // Verify the event was broadcasted correctly
      const readyData = await readyEventPromise;
      expect(readyData.playerId).toBe(setup.playerUsers[0].id);
      expect(readyData.isReady).toBe(true);
      expect(readyData.readyPlayers).toContain(setup.playerUsers[0].id);
      expect(readyData.autoStartTriggered).toBe(true); // Single player should trigger auto-start
    });

    it("should allow player to set unready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0); // Use 2 players so auto-start doesn't trigger
      const { playerSockets, showmanSocket } = setup;

      // First set player ready
      await utils.setPlayerReady(playerSockets[0]);

      // Listen for unready event on showman socket
      const unreadyEventPromise = utils.waitForPlayerUnready(showmanSocket);

      // Player sets unready
      await utils.setPlayerUnready(playerSockets[0]);

      // Verify the event was broadcasted correctly
      const unreadyData = await unreadyEventPromise;
      expect(unreadyData.playerId).toBe(setup.playerUsers[0].id);
      expect(unreadyData.isReady).toBe(false);
      expect(unreadyData.readyPlayers).not.toContain(setup.playerUsers[0].id);
      expect(unreadyData.autoStartTriggered).toBe(false);
    });

    it("should trigger auto-start when all players are ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 1);
      const { playerSockets, showmanSocket, spectatorSockets } = setup;

      await utils.setPlayerReady(playerSockets[0]);
      await utils.setPlayerReady(playerSockets[1]);

      await utils.waitForNoEvent(showmanSocket, SocketIOGameEvents.START);

      const finalReadyOnShowmanPromise = utils.waitForEvent<PlayerReadinessBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.PLAYER_READY
      );
      const finalReadyOnSpectatorPromise = utils.waitForEvent<PlayerReadinessBroadcastData>(
        spectatorSockets[0],
        SocketIOGameEvents.PLAYER_READY
      );
      const startPromises = [showmanSocket, ...playerSockets, spectatorSockets[0]].map((socket) =>
        utils.waitForEvent<GameStartBroadcastData>(socket, SocketIOGameEvents.START)
      );

      await utils.setPlayerReady(playerSockets[2]);

      const [finalReadyOnShowman, finalReadyOnSpectator, ...startEvents] = await Promise.all([
        finalReadyOnShowmanPromise,
        finalReadyOnSpectatorPromise,
        ...startPromises
      ]);

      for (const readyData of [finalReadyOnShowman, finalReadyOnSpectator]) {
        expect(readyData.playerId).toBe(setup.playerUsers[2].id);
        expect(readyData.isReady).toBe(true);
        expect(readyData.autoStartTriggered).toBe(true);
        expect(readyData.readyPlayers).toEqual(
          expect.arrayContaining(setup.playerUsers.map((user) => user.id))
        );
      }

      for (const startData of startEvents) {
        expect(startData.currentRound).toBeDefined();
        expect(startData.currentRound.order).toBe(0);
      }

      const gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.currentRound?.order).toBe(0);
      expect(gameState?.readyPlayers).toBeNull();
    });

    it("should not count showman as required for ready state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      const startPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.START);

      // Single player ready should trigger auto-start
      await utils.setPlayerReady(playerSockets[0]);

      expect(await startPromise).toBeDefined();
    });

    it("should remove player from ready list when they leave", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0); // Use 3 players so auto-start doesn't trigger with 2
      const { showmanSocket, playerSockets } = setup;

      // Set two players ready (but not all three, so no auto-start)

      const readyPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.PLAYER_READY);
      await utils.setPlayerReady(playerSockets[0]);
      await readyPromise;

      const readyPromise2 = utils.waitForEvent(showmanSocket, SocketIOGameEvents.PLAYER_READY);
      await utils.setPlayerReady(playerSockets[1]);
      await readyPromise2;

      // Verify initial state
      const beforeLeave = await utils.getGameState(setup.gameId);

      // Ensure we have both players ready before proceeding
      expect(beforeLeave?.readyPlayers).toBeDefined();
      expect(beforeLeave!.readyPlayers).toHaveLength(2);
      expect(beforeLeave!.readyPlayers).toContain(setup.playerUsers[0].id);
      expect(beforeLeave!.readyPlayers).toContain(setup.playerUsers[1].id);

      const leavePromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      // First player disconnects (which triggers ready state cleanup)
      await utils.disconnectAndCleanup(playerSockets[0]);

      await leavePromise;

      const gameState = await utils.getGameState(setup.gameId);

      // Check game state - should only have second player ready
      expect(gameState?.readyPlayers).toBeDefined();
      expect(gameState!.readyPlayers).toHaveLength(1);
      expect(gameState!.readyPlayers).toContain(setup.playerUsers[1].id);
      expect(gameState!.readyPlayers).not.toContain(setup.playerUsers[0].id);
    });

    it("should clear ready state when game starts manually", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { playerSockets, showmanSocket } = setup;

      // Set one player ready (but not all)
      await utils.setPlayerReady(playerSockets[0]);

      // Showman starts game manually
      await utils.startGame(showmanSocket);

      // Check game state - ready list should be cleared
      const gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.readyPlayers).toBeNull();
    });
  });

  describe("Player Ready Error Cases", () => {
    it("should reject spectators trying to set ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
      const { spectatorSockets } = setup;

      const errorPromise = utils.waitForEvent<{ message: string }>(
        spectatorSockets[0],
        SocketIOEvents.ERROR
      );

      // Spectator tries to set ready
      spectatorSockets[0].emit(SocketIOGameEvents.PLAYER_READY);
      const error = await errorPromise;

      expect(error.message).toBeDefined();
      expect(error.message).toContain("player"); // Should mention only players can set ready
    });

    it("should reject showman trying to set ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      const errorPromise = utils.waitForEvent<{ message: string }>(
        showmanSocket,
        SocketIOEvents.ERROR
      );

      // Showman tries to set ready
      showmanSocket.emit(SocketIOGameEvents.PLAYER_READY);
      const error = await errorPromise;

      expect(error.message).toBeDefined();
      expect(error.message).toContain("player"); // Should mention only players can set ready
    });

    it("should reject players trying to set ready when game is started", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets, showmanSocket } = setup;

      // Start the game
      await utils.startGame(showmanSocket);

      const errorPromise = utils.waitForEvent<{ message: string }>(
        playerSockets[0],
        SocketIOEvents.ERROR
      );

      // Player tries to set ready after game started
      playerSockets[0].emit(SocketIOGameEvents.PLAYER_READY);

      expect((await errorPromise).message).toContain("already started");
    });

    it("should reject players not in a game trying to set ready", async () => {
      const { socket: outsider } = await utils.createGameClient(app, userRepo);

      const errorPromise = utils.waitForEvent<{ message: string }>(outsider, SocketIOEvents.ERROR);

      // Outsider tries to set ready
      outsider.emit(SocketIOGameEvents.PLAYER_READY);

      expect((await errorPromise).message).toBeDefined();
    });
  });

  describe("Player Ready State Synchronization", () => {
    it("should handle multiple players setting ready/unready rapidly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { playerSockets } = setup;

      // Player 0 goes ready
      await utils.setPlayerReady(playerSockets[0]);

      let gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.readyPlayers).toContain(setup.playerUsers[0].id);

      // Player 1 goes ready
      await utils.setPlayerReady(playerSockets[1]);

      gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.readyPlayers).toHaveLength(2);

      // Player 0 goes unready
      await utils.setPlayerUnready(playerSockets[0]);

      gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.readyPlayers).toHaveLength(1);
      expect(gameState?.readyPlayers).toContain(setup.playerUsers[1].id);
    });

    it("should maintain ready state consistency during player joins/leaves", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0); // Use 3 players so no auto-start
      const { playerSockets } = setup;

      // Set two players ready (but not all, so no auto-start)
      await utils.setPlayerReady(playerSockets[0]);
      await utils.setPlayerReady(playerSockets[1]);

      // Add a new player
      const { socket: newPlayer } = await utils.createGameClient(app, userRepo);
      await utils.joinGame(newPlayer, setup.gameId, PlayerRole.PLAYER);

      // Verify ready state is preserved for existing players
      const gameStateAfterJoin = await utils.getGameState(setup.gameId);
      expect(gameStateAfterJoin?.readyPlayers).toHaveLength(2);
      expect(gameStateAfterJoin?.readyPlayers).toContain(setup.playerUsers[0].id);
      expect(gameStateAfterJoin?.readyPlayers).toContain(setup.playerUsers[1].id);

      // New player should not be ready
      expect(await utils.areAllPlayersReady(setup.gameId)).toBe(false);
    });
  });
});
