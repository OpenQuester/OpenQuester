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

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Game Join Slot Allocation Edge Cases", () => {
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
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  it("should handle three players joining simultaneously without slot collision", async () => {
    const { socket: showmanSocket, gameId } = await utils.createGameWithShowman(
      app,
      userRepo
    );

    try {
      // Create three players
      const player1 = await utils.createGameClient(app, userRepo);
      const player2 = await utils.createGameClient(app, userRepo);
      const player3 = await utils.createGameClient(app, userRepo);

      const players = [player1, player2, player3];

      // Set up join promises for all players
      const joinPromises = players.map((p) =>
        utils.waitForEvent(p.socket, SocketIOGameEvents.GAME_DATA)
      );

      // Emit all joins simultaneously
      players.forEach((p) => {
        p.socket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
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

      // Cleanup
      for (const p of players) {
        await utils.disconnectAndCleanup(p.socket);
      }
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);
    }
  });

  it("should correctly reassign slot when player leaves and rejoins during concurrent joins", async () => {
    const { socket: showmanSocket, gameId } = await utils.createGameWithShowman(
      app,
      userRepo
    );

    try {
      // First player joins
      const { socket: player1Socket, user: user1 } =
        await utils.createGameClient(app, userRepo);
      await utils.joinGame(player1Socket, gameId, PlayerRole.PLAYER);

      // Player 1 leaves
      const leavePromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.LEAVE
      );
      player1Socket.emit(SocketIOGameEvents.LEAVE);
      await leavePromise;

      // Create second player
      const { socket: player2Socket, user: user2 } =
        await utils.createGameClient(app, userRepo);

      // Player 1 and player 2 try to join simultaneously
      const join1Promise = utils.waitForEvent(
        player1Socket,
        SocketIOGameEvents.GAME_DATA
      );
      const join2Promise = utils.waitForEvent(
        player2Socket,
        SocketIOGameEvents.GAME_DATA
      );

      player1Socket.emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER,
      });
      player2Socket.emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER,
      });

      await Promise.all([join1Promise, join2Promise]);

      // Verify both players have valid, different slots
      const gameFinal = await utils.getGameFromGameService(gameId);
      const p1Final = gameFinal.getPlayer(user1.id, {
        fetchDisconnected: false,
      });
      const p2Final = gameFinal.getPlayer(user2.id, {
        fetchDisconnected: false,
      });

      expect(p1Final).toBeDefined();
      expect(p2Final).toBeDefined();
      expect(p1Final!.gameSlot).not.toBeNull();
      expect(p2Final!.gameSlot).not.toBeNull();
      expect(p1Final!.gameSlot).not.toBe(p2Final!.gameSlot);

      await utils.disconnectAndCleanup(player1Socket);
      await utils.disconnectAndCleanup(player2Socket);
    } finally {
      await utils.disconnectAndCleanup(showmanSocket);
    }
  });
});
