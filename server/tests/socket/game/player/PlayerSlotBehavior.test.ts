import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Player Slot Behavior", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let utils: SocketGameTestUtils;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    utils = suite.utils;
    userRepo = suite.userRepo;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Slot Preservation on Reconnect", () => {
    /**
     * This test verifies that when a player reconnects without specifying targetSlot,
     * they should ideally preserve their original slot. Currently, the implementation
     * recalculates the slot using _getFirstFreeSlotIndex().
     *
     * Expected behavior: Player keeps original slot X on reconnect without targetSlot
     * Current behavior: Player gets first available slot (may differ from original)
     */
    it("should preserve original slot when player reconnects without targetSlot", async () => {
      await suite.scenario(async () => {
        // 1. Setup game with showman and player
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        // 2. Create player and join with specific slot
        const { socket: playerSocket, user: playerUser } = await utils.createGameClient(
          app,
          userRepo
        );
        const targetSlot = 2;

        // Join with specific target slot
        const gameData = await utils.joinGameWithSlotAndData(
          playerSocket,
          gameId,
          PlayerRole.PLAYER,
          targetSlot
        );

        // Verify player got assigned the requested slot
        const playerInGame = gameData.players.find((p: PlayerDTO) => p.meta.id === playerUser.id);
        expect(playerInGame).toBeDefined();
        expect(playerInGame!.slot).toBe(targetSlot);

        // 3. Player disconnects
        await utils.disconnectAndCleanup(playerSocket);

        // 4. Player reconnects without specifying targetSlot
        const { socket: reconnectedSocket } = await utils.createSocketForExistingUser(
          app,
          playerUser.id
        );

        const reconnectGameData = await utils.joinGameWithSlotAndData(
          reconnectedSocket,
          gameId,
          PlayerRole.PLAYER,
          null // No targetSlot specified
        );

        // 5. Verify player still has their original slot
        const reconnectedPlayer = reconnectGameData.players.find(
          (p: PlayerDTO) => p.meta.id === playerUser.id
        );
        expect(reconnectedPlayer).toBeDefined();
        expect(reconnectedPlayer!.slot).toBe(targetSlot);
      });
    });

    it("should get first available slot when original slot is taken during reconnect", async () => {
      await suite.scenario(async () => {
        // 1. Setup game with showman
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        // 2. Create first player and join with specific slot
        const { socket: playerSocket1, user: playerUser1 } = await utils.createGameClient(
          app,
          userRepo
        );
        const originalSlot = 1;

        await utils.joinGameWithSlot(playerSocket1, gameId, PlayerRole.PLAYER, originalSlot);

        // 3. First player disconnects
        await utils.disconnectAndCleanup(playerSocket1);

        // 4. Second player joins and takes the same slot
        const { socket: playerSocket2 } = await utils.createGameClient(app, userRepo);
        await utils.joinGameWithSlot(playerSocket2, gameId, PlayerRole.PLAYER, originalSlot);

        // 5. First player reconnects without targetSlot (original slot is now taken)
        const { socket: reconnectedSocket } = await utils.createSocketForExistingUser(
          app,
          playerUser1.id
        );

        const reconnectGameData = await utils.joinGameWithSlotAndData(
          reconnectedSocket,
          gameId,
          PlayerRole.PLAYER,
          null
        );

        // 6. Verify player got a different slot (first free one, not the original)
        const reconnectedPlayer = reconnectGameData.players.find(
          (p: PlayerDTO) => p.meta.id === playerUser1.id
        );
        expect(reconnectedPlayer).toBeDefined();
        expect(reconnectedPlayer!.slot).not.toBeNull();
        // Should get first available slot which is 0 (since slot 1 is taken)
        expect(reconnectedPlayer!.slot).toBe(0);
      });
    });

    it("should throw error when reconnecting player cannot get any slot (game full)", async () => {
      await suite.scenario(async (scenario) => {
        // 1. Setup game with showman
        const { gameId } = await utils.createGameWithShowman(app, userRepo);

        // Get game to determine max players
        const game = await utils.getGameFromGameService(gameId);
        const maxPlayers = game.maxPlayers;

        // 2. Create first player, join and disconnect
        const { socket: playerSocket1, user: playerUser1 } = await utils.createGameClient(
          app,
          userRepo
        );
        await utils.joinGame(playerSocket1, gameId, PlayerRole.PLAYER);
        await utils.disconnectAndCleanup(playerSocket1);

        // 3. Fill all slots with other players
        const otherPlayerSockets = [];
        for (let i = 0; i < maxPlayers; i++) {
          const { socket: otherSocket } = await utils.createGameClient(app, userRepo);
          await utils.joinGameWithSlot(otherSocket, gameId, PlayerRole.PLAYER, i);
          otherPlayerSockets.push(otherSocket);
        }

        // 4. First player tries to reconnect (all slots are taken)
        const { socket: reconnectedSocket } = await utils.createSocketForExistingUser(
          app,
          playerUser1.id
        );

        // 5. Expect error when joining without targetSlot
        const errorPromise = scenario.waitForEvent(reconnectedSocket, SocketIOEvents.ERROR, 3000);

        scenario.actor(reconnectedSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
          targetSlot: null
        });

        const error = await errorPromise;
        expect(error.message).toContain("game is full");
      });
    });
  });

  describe("SHOWMAN Role with targetSlot", () => {
    it("should ignore targetSlot when joining as SHOWMAN", async () => {
      await suite.scenario(async () => {
        // 1. Create a game with a player first (need someone other than showman in game)
        const {
          socket: showmanSocket,
          gameId,
          user: showmanUser
        } = await utils.createGameWithShowman(app, userRepo);

        // Add a player to keep the game alive when showman leaves
        const { socket: playerSocket } = await utils.createGameClient(app, userRepo);
        await utils.joinGame(playerSocket, gameId, PlayerRole.PLAYER);

        // 2. Verify initial showman has no slot assigned (slot should be null)
        const game = await utils.getGameFromGameService(gameId);
        const showmanPlayer = game.players.find((p) => p.meta.id === showmanUser.id);

        expect(showmanPlayer).toBeDefined();
        expect(showmanPlayer!.role).toBe(PlayerRole.SHOWMAN);
        expect(showmanPlayer!.gameSlot).toBeNull();

        // 3. Showman leaves to free up the showman slot
        await utils.leaveGame(showmanSocket);

        // 4. Create another user to join as showman with targetSlot
        const { socket: newShowmanSocket, user: newShowmanUser } = await utils.createGameClient(
          app,
          userRepo
        );

        const gameData = await utils.joinGameWithSlotAndData(
          newShowmanSocket,
          gameId,
          PlayerRole.SHOWMAN,
          5 // This slot should be ignored for showman
        );

        // 5. Verify new showman has no slot assigned (slot should be null)
        const newShowmanPlayer = gameData.players.find(
          (p: PlayerDTO) => p.meta.id === newShowmanUser.id
        );
        expect(newShowmanPlayer).toBeDefined();
        expect(newShowmanPlayer!.role).toBe(PlayerRole.SHOWMAN);
        expect(newShowmanPlayer!.slot).toBeNull();
      });
    });

    it("should ignore targetSlot when changing role to SHOWMAN", async () => {
      await suite.scenario(async (scenario) => {
        // 1. Setup game with showman and player
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

        const playerUserId = setup.playerUsers[0].id;

        // Get player's current slot
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.players.find((p) => p.meta.id === playerUserId);
        expect(player).toBeDefined();
        const playerOriginalSlot = player!.gameSlot;
        expect(playerOriginalSlot).not.toBeNull();

        // 2. Showman leaves to free up the showman slot
        await utils.leaveGame(setup.showmanSocket);

        // 3. Player tries to become showman
        const roleChangePromise = scenario.waitForEvent(
          setup.playerSockets[0],
          SocketIOGameEvents.PLAYER_ROLE_CHANGE,
          3000
        );

        scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: playerUserId,
          newRole: PlayerRole.SHOWMAN
        });

        const roleData = await roleChangePromise;

        // 4. Verify player is now showman with null slot
        const updatedPlayer = roleData.players.find((p: PlayerDTO) => p.meta.id === playerUserId);
        expect(updatedPlayer).toBeDefined();
        expect(updatedPlayer!.role).toBe(PlayerRole.SHOWMAN);
        expect(updatedPlayer!.slot).toBeNull();
      });
    });
  });
});
