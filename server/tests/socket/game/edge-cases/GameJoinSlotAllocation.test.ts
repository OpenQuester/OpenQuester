import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Game Join Slot Allocation Edge Cases", () => {
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

  it("should handle three players joining simultaneously without slot collision", async () => {
    await suite.scenario(async (scenario) => {
      const { gameId } = await utils.createGameWithShowman(app, userRepo);

      // Create three players
      const player1 = await utils.createGameClient(app, userRepo);
      const player2 = await utils.createGameClient(app, userRepo);
      const player3 = await utils.createGameClient(app, userRepo);

      const players = [player1, player2, player3];

      // Set up join promises for all players
      const joinPromises = players.map((p) =>
        scenario.waitForEvent(p.socket, SocketIOGameEvents.GAME_DATA)
      );

      // Emit all joins simultaneously
      players.forEach((p) => {
        scenario.actor(p.socket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER
        });
      });

      // Wait for all joins to complete
      await Promise.all(joinPromises);

      // Get final game state
      const game = await utils.getGameFromGameService(gameId);

      // Get all player slots
      const slots = players.map((p) => {
        const player = game.getPlayer(p.user.id, { fetchDisconnected: false });
        expect(player).toBeDefined();
        expect(player!.gameSlot).not.toBeNull();
        return player!.gameSlot!;
      });

      // Verify all slots are unique
      const uniqueSlots = new Set(slots);
      expect(uniqueSlots.size).toBe(3);

      // Verify all slots are in valid range
      slots.forEach((slot) => {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThan(game.maxPlayers);
      });
    });
  });

  it("should correctly reassign slot when player leaves and rejoins during concurrent joins", async () => {
    await suite.scenario(async (scenario) => {
      const { socket: showmanSocket, gameId } = await utils.createGameWithShowman(app, userRepo);

      // First player joins
      const { socket: player1Socket, user: user1 } = await utils.createGameClient(app, userRepo);
      await utils.joinGame(player1Socket, gameId, PlayerRole.PLAYER);

      // Player 1 leaves
      const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      scenario.actor(player1Socket).emit(SocketIOGameEvents.LEAVE);
      await leavePromise;

      // Create second player
      const { socket: player2Socket, user: user2 } = await utils.createGameClient(app, userRepo);

      // Player 1 and player 2 try to join simultaneously
      const join1Promise = scenario.waitForEvent(player1Socket, SocketIOGameEvents.GAME_DATA);
      const join2Promise = scenario.waitForEvent(player2Socket, SocketIOGameEvents.GAME_DATA);

      scenario.actor(player1Socket).emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER
      });
      scenario.actor(player2Socket).emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER
      });

      await Promise.all([join1Promise, join2Promise]);

      // Verify both players have valid, different slots
      const gameFinal = await utils.getGameFromGameService(gameId);
      const p1Final = gameFinal.getPlayer(user1.id, {
        fetchDisconnected: false
      });
      const p2Final = gameFinal.getPlayer(user2.id, {
        fetchDisconnected: false
      });

      expect(p1Final).toBeDefined();
      expect(p2Final).toBeDefined();
      expect(p1Final!.gameSlot).not.toBeNull();
      expect(p2Final!.gameSlot).not.toBeNull();
      expect(p1Final!.gameSlot).not.toBe(p2Final!.gameSlot);
    });
  });

  describe("Target Slot Selection", () => {
    it("should allow joining with a specific target slot", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        const { socket: playerSocket, user } = await utils.createGameClient(app, userRepo);

        // Join with target slot 2
        const gameDataPromise = scenario.waitForEvent(playerSocket, SocketIOGameEvents.GAME_DATA);
        scenario.actor(playerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: 2
        });
        await gameDataPromise;

        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(user.id, { fetchDisconnected: false });

        expect(player).toBeDefined();
        expect(player!.gameSlot).toBe(2);
      });
    });

    it("should reject joining with an invalid slot number (out of range)", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        const { socket: playerSocket } = await utils.createGameClient(app, userRepo);

        const errorPromise = scenario.waitForEvent(playerSocket, SocketIOEvents.ERROR);
        scenario.actor(playerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: 999 // Invalid slot
        });
        const error = await errorPromise;

        expect(error.message).toContain("Invalid slot number");
      });
    });

    it("should reject joining with an already occupied slot", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        // First player joins with slot 1
        const { socket: player1Socket } = await utils.createGameClient(app, userRepo);
        const gameData1Promise = scenario.waitForEvent(player1Socket, SocketIOGameEvents.GAME_DATA);
        scenario.actor(player1Socket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: 1
        });
        await gameData1Promise;

        // Second player tries to join with same slot
        const { socket: player2Socket } = await utils.createGameClient(app, userRepo);
        const errorPromise = scenario.waitForEvent(player2Socket, SocketIOEvents.ERROR);
        scenario.actor(player2Socket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: 1 // Same slot as player 1
        });
        const error = await errorPromise;

        expect(error.message).toContain("already occupied");
      });
    });

    it("should auto-assign first available slot when targetSlot is not provided", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        // First player joins with slot 0
        const { socket: player1Socket } = await utils.createGameClient(app, userRepo);
        const gameData1Promise = scenario.waitForEvent(player1Socket, SocketIOGameEvents.GAME_DATA);
        scenario.actor(player1Socket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: 0
        });
        await gameData1Promise;

        // Second player joins without targetSlot
        const { socket: player2Socket, user: user2 } = await utils.createGameClient(app, userRepo);
        const gameData2Promise = scenario.waitForEvent(player2Socket, SocketIOGameEvents.GAME_DATA);
        scenario.actor(player2Socket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER
          // No targetSlot - should auto-assign
        });
        await gameData2Promise;

        const game = await utils.getGameFromGameService(gameId);
        const player2 = game.getPlayer(user2.id, { fetchDisconnected: false });

        expect(player2).toBeDefined();
        // Should get slot 1 since slot 0 is taken
        expect(player2!.gameSlot).toBe(1);
      });
    });

    it("should ignore targetSlot for spectator role", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        const { socket: spectatorSocket, user } = await utils.createGameClient(app, userRepo);

        // Join as spectator with targetSlot (should be ignored)
        const gameDataPromise = scenario.waitForEvent(
          spectatorSocket,
          SocketIOGameEvents.GAME_DATA
        );
        scenario.actor(spectatorSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
          targetSlot: 2 // Should be ignored for spectators
        });
        await gameDataPromise;

        const game = await utils.getGameFromGameService(gameId);
        const spectator = game.getPlayer(user.id, { fetchDisconnected: false });

        expect(spectator).toBeDefined();
        expect(spectator!.role).toBe(PlayerRole.SPECTATOR);
        expect(spectator!.gameSlot).toBeNull();
      });
    });

    it("should reject negative slot numbers", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        const { socket: playerSocket } = await utils.createGameClient(app, userRepo);

        const errorPromise = scenario.waitForEvent(playerSocket, SocketIOEvents.ERROR);
        scenario.actor(playerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: -1
        });
        const error = await errorPromise;

        expect(error.message).toContain("must be greater than or equal to 0");
      });
    });
  });
});
