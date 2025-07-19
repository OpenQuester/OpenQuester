import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import { type Express } from "express";

import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  PlayerRoleChangeBroadcastData,
  PlayerScoreChangeBroadcastData,
  PlayerSlotChangeBroadcastData,
  TurnPlayerChangeBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("SocketIOGameLobby", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    const keysUpdated = await redisClient.keys("*");
    if (keysUpdated.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keysUpdated}`);
    }
  });

  it("should successfully change player score", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      const targetPlayerId = setup.playerUsers[0].id;
      const newScore = 500;

      // Wait for SCORE_CHANGED event
      const scoreChangeEventPromise =
        new Promise<PlayerScoreChangeBroadcastData>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error("SCORE_CHANGED event not received within timeout")
            );
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.SCORE_CHANGED,
            (data: PlayerScoreChangeBroadcastData) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        });

      // Showman changes player score
      setup.showmanSocket.emit(SocketIOGameEvents.SCORE_CHANGED, {
        playerId: targetPlayerId,
        newScore,
      });

      // Wait for event to be received
      const scoreData = await scoreChangeEventPromise;

      // Verify event data
      expect(scoreData.playerId).toBe(targetPlayerId);
      expect(scoreData.newScore).toBe(newScore);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should successfully change player role", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      const targetPlayerId = setup.playerUsers[0].id;
      const newRole = PlayerRole.SPECTATOR;

      // Wait for PLAYER_ROLE_CHANGE event
      const roleChangeEventPromise = new Promise<PlayerRoleChangeBroadcastData>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error("PLAYER_ROLE_CHANGE event not received within timeout")
            );
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.PLAYER_ROLE_CHANGE,
            (data: PlayerRoleChangeBroadcastData) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Showman changes player role
      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
        playerId: targetPlayerId,
        newRole,
      });

      // Wait for event to be received
      const roleData = await roleChangeEventPromise;

      // Verify event data
      expect(roleData.playerId).toBe(targetPlayerId);
      expect(roleData.newRole).toBe(newRole);
      expect(roleData.players).toBeDefined();
      expect(Array.isArray(roleData.players)).toBe(true);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should successfully change turn player", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const gameData = await utils.getGameState(setup.gameId);
      expect(gameData).toBeDefined();
      const newTurnPlayerId =
        gameData?.currentTurnPlayerId === setup.playerUsers[1].id
          ? setup.playerUsers[0].id
          : setup.playerUsers[1].id;

      // Wait for TURN_PLAYER_CHANGED event
      const turnChangeEventPromise = new Promise<TurnPlayerChangeBroadcastData>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error("TURN_PLAYER_CHANGED event not received within timeout")
            );
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.TURN_PLAYER_CHANGED,
            (data: TurnPlayerChangeBroadcastData) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Showman changes turn player
      setup.showmanSocket.emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
        newTurnPlayerId,
      });

      // Wait for event to be received
      const turnData = await turnChangeEventPromise;

      // Verify event data
      expect(turnData.newTurnPlayerId).toBe(newTurnPlayerId);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should successfully change player slot", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      const targetSlot = 3;

      // Wait for PLAYER_SLOT_CHANGE event
      const slotChangeEventPromise = new Promise<PlayerSlotChangeBroadcastData>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error("PLAYER_SLOT_CHANGE event not received within timeout")
            );
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.PLAYER_SLOT_CHANGE,
            (data: PlayerSlotChangeBroadcastData) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Player changes their own slot
      setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot,
      });

      // Wait for event to be received
      const slotData = await slotChangeEventPromise;

      // Verify event data
      expect(slotData.playerId).toBe(setup.playerUsers[0].id);
      expect(slotData.newSlot).toBe(targetSlot);
      expect(slotData.players).toBeDefined();
      expect(Array.isArray(slotData.players)).toBe(true);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent non-showman from changing player scores", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const targetPlayerId = setup.playerUsers[1].id;
      const newScore = 500;

      // Try to change score from a player socket (should fail)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Expected error for non-showman changing score"));
        }, 3000);

        setup.playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toContain("Only showman can manage players"); // Should get permission error
          resolve();
        });

        setup.playerSockets[0].emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: targetPlayerId,
          newScore,
        });
      });
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent non-showman from changing player roles", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const targetPlayerId = setup.playerUsers[1].id;
      const newRole = PlayerRole.SPECTATOR;

      // Try to change role from a player socket (should fail)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Expected error for non-showman changing role"));
        }, 3000);

        setup.playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toContain("Only showman can manage players"); // Should get permission error
          resolve();
        });

        setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_ROLE_CHANGE, {
          playerId: targetPlayerId,
          newRole,
        });
      });
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent non-showman from changing turn player", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const newTurnPlayerId = setup.playerUsers[1].id;

      // Try to change turn from a player socket (should fail)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Expected error for non-showman changing turn"));
        }, 3000);

        setup.playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toContain("Only showman can manage players"); // Should get permission error
          resolve();
        });

        setup.playerSockets[0].emit(SocketIOGameEvents.TURN_PLAYER_CHANGED, {
          newTurnPlayerId,
        });
      });
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should handle slot conflicts gracefully", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const game = await utils.getGameFromGameService(setup.gameId);
      expect(game).toBeDefined();

      // Get Player 1's actual slot (0-indexed from Game entity)
      const player1 = game.players.find(
        (p) => p.meta.id === setup.playerUsers[1].id
      );
      expect(player1).toBeDefined();
      const playerCurrentSlot = player1!.gameSlot;
      expect(playerCurrentSlot).not.toBeNull();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Expected error for slot conflict not received"));
        }, 3000);

        setup.playerSockets[1].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          // Should get slot conflict error
          expect(error.message).toBeDefined();
          expect(error.message).toContain("Cannot change to the same slot");
          resolve();
        });

        setup.playerSockets[1].emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
          targetSlot: playerCurrentSlot,
        });
      });
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should allow showman to change player's slot", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const targetPlayerId = setup.playerUsers[0].id;

      // Get current game entity to find player's current slot
      const game = await utils.getGameFromGameService(setup.gameId);
      const targetPlayer = game.getPlayer(targetPlayerId, {
        fetchDisconnected: false,
      });
      const currentSlot = targetPlayer?.gameSlot ?? 0;

      // Find an unoccupied slot different from current slot
      const allPlayers = game.players.filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      );
      const occupiedSlots = allPlayers
        .map((p) => p.gameSlot)
        .filter((s) => s !== null);
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
      const slotChangeEventPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_SLOT_CHANGE,
        2000
      );

      // Showman changes player's slot
      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: newSlot,
        playerId: targetPlayerId,
      });

      // Wait for event to be received
      const slotData = await slotChangeEventPromise;

      // Verify event data
      expect(slotData.playerId).toBe(targetPlayerId);
      expect(slotData.newSlot).toBe(newSlot);
      expect(slotData.players).toBeDefined();
      expect(Array.isArray(slotData.players)).toBe(true);

      // Verify the player's slot was actually changed
      const updatedPlayer = slotData.players.find(
        (p: PlayerDTO) => p.meta.id === targetPlayerId
      );
      expect(updatedPlayer.slot).toBe(newSlot);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent non-showman from changing another player's slot", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const targetPlayerId = setup.playerUsers[1].id;
      const newSlot = 1;

      // Try to change another player's slot from a player socket (should fail)
      const errorPromise = utils.waitForEvent(
        setup.playerSockets[0],
        SocketIOEvents.ERROR,
        2000
      );

      setup.playerSockets[0].emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: newSlot,
        playerId: targetPlayerId,
      });

      const error = await errorPromise;
      expect(error.message).toContain("Only showman can manage players");
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent changing to occupied slot", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

    try {
      const targetPlayerId = setup.playerUsers[0].id;

      // Get current game entity to find an occupied slot
      const game = await utils.getGameFromGameService(setup.gameId);
      const players = game.players.filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME
      );
      const occupiedSlot =
        players.find((p) => p.meta.id !== targetPlayerId)?.gameSlot ?? 1;

      // Try to change to occupied slot (should fail)
      const errorPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOEvents.ERROR,
        2000
      );

      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_SLOT_CHANGE, {
        targetSlot: occupiedSlot,
        playerId: targetPlayerId,
      });

      const error = await errorPromise;
      expect(error.message).toContain("This slot is already occupied");
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });
});
