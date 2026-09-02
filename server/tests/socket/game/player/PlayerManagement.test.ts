import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  PlayerRoleChangeBroadcastData,
  PlayerScoreChangeBroadcastData,
  PlayerSlotChangeBroadcastData,
  TurnPlayerChangeBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("SocketIOGameLobby", () => {
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

  it("should successfully change player score", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      const targetPlayerId = setup.playerUsers[0].id;
      const newScore = 500;

      const scoreChangeEventPromise = scenario.waitForEvent<PlayerScoreChangeBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.SCORE_CHANGED
      );

      // Showman changes player score
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
        playerId: targetPlayerId,
        newScore
      });

      // Wait for event to be received
      const scoreData = await scoreChangeEventPromise;

      // Verify event data
      expect(scoreData.playerId).toBe(targetPlayerId);
      expect(scoreData.newScore).toBe(newScore);
    });
  });

  it("should successfully change player role", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      const targetPlayerId = setup.playerUsers[0].id;
      const newRole = PlayerRole.SPECTATOR;

      const roleChangeEventPromise = scenario.waitForEvent<PlayerRoleChangeBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_ROLE_CHANGE
      );

      // Showman changes player role
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
        playerId: targetPlayerId,
        newRole
      });

      // Wait for event to be received
      const roleData = await roleChangeEventPromise;

      // Verify event data
      expect(roleData.playerId).toBe(targetPlayerId);
      expect(roleData.newRole).toBe(newRole);
      expect(roleData.players).toBeDefined();
      expect(Array.isArray(roleData.players)).toBe(true);
    });
  });

  it("should successfully change turn player", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const gameData = await utils.getGameState(setup.gameId);
      expect(gameData).toBeDefined();
      const newTurnPlayerId =
        gameData?.currentTurnPlayerId === setup.playerUsers[1].id
          ? setup.playerUsers[0].id
          : setup.playerUsers[1].id;

      const turnChangeEventPromise = scenario.waitForEvent<TurnPlayerChangeBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.TURN_PLAYER_CHANGED
      );

      // Showman changes turn player
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
        newTurnPlayerId
      });

      // Wait for event to be received
      const turnData = await turnChangeEventPromise;

      // Verify event data
      expect(turnData.newTurnPlayerId).toBe(newTurnPlayerId);
    });
  });

  it("should successfully change player slot", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      const targetSlot = 3;

      const slotChangeEventPromise = scenario.waitForEvent<PlayerSlotChangeBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_SLOT_CHANGE
      );

      // Player changes their own slot
      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot
      });

      // Wait for event to be received
      const slotData = await slotChangeEventPromise;

      // Verify event data
      expect(slotData.playerId).toBe(setup.playerUsers[0].id);
      expect(slotData.newSlot).toBe(targetSlot);
      expect(slotData.players).toBeDefined();
      expect(Array.isArray(slotData.players)).toBe(true);
    });
  });

  it("should prevent non-showman from changing player scores", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const targetPlayerId = setup.playerUsers[1].id;
      const newScore = 500;

      const errorPromise = scenario.waitForEvent<{ message: string }>(
        setup.playerSockets[0],
        SocketIOEvents.ERROR
      );
      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.SCORE_CHANGED, {
        playerId: targetPlayerId,
        newScore
      });
      const error = await errorPromise;
      expect(error.message).toContain("Only showman can manage players");
    });
  });

  it("should prevent non-showman from changing player roles", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const targetPlayerId = setup.playerUsers[1].id;
      const newRole = PlayerRole.SPECTATOR;

      const errorPromise = scenario.waitForEvent<{ message: string }>(
        setup.playerSockets[0],
        SocketIOEvents.ERROR
      );
      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
        playerId: targetPlayerId,
        newRole
      });
      const error = await errorPromise;
      expect(error.message).toContain("Only showman can manage players");
    });
  });

  it("should prevent non-showman from changing turn player", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const newTurnPlayerId = setup.playerUsers[1].id;

      const errorPromise = scenario.waitForEvent<{ message: string }>(
        setup.playerSockets[0],
        SocketIOEvents.ERROR
      );
      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
        newTurnPlayerId
      });
      const error = await errorPromise;
      expect(error.message).toContain("Only showman can manage players");
    });
  });

  it("should handle slot conflicts gracefully", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const game = await utils.getGameFromGameService(setup.gameId);
      expect(game).toBeDefined();

      // Get Player 1's actual slot (0-indexed from Game entity)
      const player1 = game.players.find((p) => p.meta.id === setup.playerUsers[1].id);
      expect(player1).toBeDefined();
      const playerCurrentSlot = player1!.gameSlot;
      expect(playerCurrentSlot).not.toBeNull();

      const errorPromise = scenario.waitForEvent<{ message: string }>(
        setup.playerSockets[1],
        SocketIOEvents.ERROR
      );
      scenario.actor(setup.playerSockets[1]).emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: playerCurrentSlot
      });
      const error = await errorPromise;
      expect(error.message).toBeDefined();
      expect(error.message).toContain("Cannot change to the same slot");
    });
  });

  it("should allow showman to change player's slot", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const targetPlayerId = setup.playerUsers[0].id;

      // Get current game entity to find player's current slot
      const game = await utils.getGameFromGameService(setup.gameId);
      const targetPlayer = game.getPlayer(targetPlayerId, {
        fetchDisconnected: false
      });
      const currentSlot = targetPlayer?.gameSlot ?? 0;

      // Find an unoccupied slot different from current slot
      const allPlayers = game.players.filter(
        (p) => p.role === PlayerRole.PLAYER && p.gameStatus === PlayerGameStatus.IN_GAME
      );
      const occupiedSlots = allPlayers.map((p) => p.gameSlot).filter((s) => s !== null);
      const maxSlots = game.maxPlayers;
      let newSlot = -1;
      for (let i = 0; i < maxSlots; i++) {
        if (!occupiedSlots.includes(i) || i === currentSlot) {
          if (i !== currentSlot) {
            newSlot = i;
            break;
          }
        }
      }

      if (newSlot === -1) {
        // If no free slot, just use slot 2 if available (assuming max players > 2)
        newSlot = Math.min(2, maxSlots - 1);
        if (newSlot === currentSlot) {
          newSlot = currentSlot === 0 ? 1 : 0;
        }
      }

      // Wait for PLAYER_SLOT_CHANGE event
      const slotChangeEventPromise = scenario.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_SLOT_CHANGE
      );

      // Showman changes player's slot
      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: newSlot,
        playerId: targetPlayerId
      });

      // Wait for event to be received
      const slotData = await slotChangeEventPromise;

      // Verify event data
      expect(slotData.playerId).toBe(targetPlayerId);
      expect(slotData.newSlot).toBe(newSlot);
      expect(slotData.players).toBeDefined();
      expect(Array.isArray(slotData.players)).toBe(true);

      // Verify the player's slot was actually changed
      const updatedPlayer = slotData.players.find((p: PlayerDTO) => p.meta.id === targetPlayerId);
      expect(updatedPlayer.slot).toBe(newSlot);
    });
  });

  it("should prevent non-showman from changing another player's slot", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const targetPlayerId = setup.playerUsers[1].id;
      const newSlot = 1;

      // Try to change another player's slot from a player socket (should fail)
      const errorPromise = scenario.waitForEvent(setup.playerSockets[0], SocketIOEvents.ERROR);

      scenario.actor(setup.playerSockets[0]).emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: newSlot,
        playerId: targetPlayerId
      });

      const error = await errorPromise;
      expect(error.message).toContain("Only showman can manage players");
    });
  });

  it("should prevent changing to occupied slot", async () => {
    await suite.scenario(async (scenario) => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

      const targetPlayerId = setup.playerUsers[0].id;

      // Get current game entity to find an occupied slot
      const game = await utils.getGameFromGameService(setup.gameId);
      const players = game.players.filter(
        (p) => p.role === PlayerRole.PLAYER && p.gameStatus === PlayerGameStatus.IN_GAME
      );
      const occupiedSlot = players.find((p) => p.meta.id !== targetPlayerId)?.gameSlot ?? 1;

      // Try to change to occupied slot (should fail)
      const errorPromise = scenario.waitForEvent(setup.showmanSocket, SocketIOEvents.ERROR);

      scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: occupiedSlot,
        playerId: targetPlayerId
      });

      const error = await errorPromise;
      expect(error.message).toContain("This slot is already occupied");
    });
  });
});
