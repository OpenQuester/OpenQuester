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

import { Container, CONTAINER_TYPES } from "application/Container";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameLeaveEventPayload } from "domain/types/socket/events/game/GameLeaveEventPayload";
import {
  GameLeaveBroadcastData,
  PlayerKickBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("PlayerRestrictions", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;
  let playerGameStatsRepository: PlayerGameStatsRepository;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);

    playerGameStatsRepository = Container.get<PlayerGameStatsRepository>(
      CONTAINER_TYPES.PlayerGameStatsRepository
    );
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

  it("should prevent restricted player from joining as PLAYER or SHOWMAN, allow only SPECTATOR", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Get a player to restrict
      const targetPlayerId = setup.playerUsers[0].id;

      // Showman restricts the player
      const restrictionEventPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );

      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false,
      });

      await restrictionEventPromise;

      // Player leaves
      await utils.leaveGame(setup.playerSockets[0]);

      // Create a new socket for the restricted player to test joining
      const { cookie } = await utils.loginExistingUser(app, targetPlayerId);
      const restrictedSocket = await utils.createUnauthenticatedGameClient();

      // Authenticate the socket manually
      await (async () => {
        const authRes = await request(app)
          .post("/v1/auth/socket")
          .set("Cookie", cookie)
          .send({ socketId: restrictedSocket.id });

        if (authRes.status !== 200) {
          throw new Error(
            `Failed to authenticate socket: ${JSON.stringify(authRes.body)}`
          );
        }
      })();

      // Should fail to join as PLAYER
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected error for restricted player joining as PLAYER")
          );
        }, 3000);

        restrictedSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe(
            "You are restricted from this game and can only join as spectator"
          );
          resolve();
        });

        restrictedSocket.emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.PLAYER,
        });
      });

      // Should fail to join as SHOWMAN
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected error for restricted player joining as SHOWMAN")
          );
        }, 3000);

        restrictedSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe(
            "You are restricted from this game and can only join as spectator"
          );
          resolve();
        });

        restrictedSocket.emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.SHOWMAN,
        });
      });

      // Should succeed to join as SPECTATOR
      const joinEventPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.JOIN
      );

      restrictedSocket.emit(SocketIOGameEvents.JOIN, {
        gameId: setup.gameId,
        role: PlayerRole.SPECTATOR,
      });

      const joinData = await joinEventPromise;
      expect(joinData.role).toBe(PlayerRole.SPECTATOR);

      await utils.disconnectAndCleanup(restrictedSocket);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should prevent banned player from joining in any role", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Get a player to ban
      const targetPlayerId = setup.playerUsers[0].id;

      // Wait for both PLAYER_RESTRICTED and LEAVE events when banning
      const restrictionEventPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );
      const leaveEventPromise = utils.waitForEvent<GameLeaveBroadcastData>(
        setup.showmanSocket,
        SocketIOGameEvents.LEAVE
      );

      // Showman bans the player
      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: false,
        banned: true,
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
        const authRes = await request(app)
          .post("/v1/auth/socket")
          .set("Cookie", cookie)
          .send({ socketId: bannedSocket.id });

        if (authRes.status !== 200) {
          throw new Error(
            `Failed to authenticate socket: ${JSON.stringify(authRes.body)}`
          );
        }
      })();

      // Should fail as PLAYER
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected error for banned player joining as PLAYER")
          );
        }, 3000);

        bannedSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("You are banned in this game!");
          resolve();
        });

        bannedSocket.emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.PLAYER,
        });
      });

      // Should fail as SHOWMAN
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected error for banned player joining as SHOWMAN")
          );
        }, 3000);

        bannedSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("You are banned in this game!");
          resolve();
        });

        bannedSocket.emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.SHOWMAN,
        });
      });

      // Should fail as SPECTATOR too
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error("Expected error for banned player joining as SPECTATOR")
          );
        }, 3000);

        bannedSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("You are banned in this game!");
          resolve();
        });

        bannedSocket.emit(SocketIOGameEvents.JOIN, {
          gameId: setup.gameId,
          role: PlayerRole.SPECTATOR,
        });
      });

      await utils.disconnectAndCleanup(bannedSocket);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should successfully kick a player and emit LEAVE event", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      // Get the player to kick
      const targetPlayerId = setup.playerUsers[0].id;
      const playerSocket = setup.playerSockets[0];

      // Wait for PLAYER_KICKED event on showman socket
      const kickEventPromise = new Promise<PlayerKickBroadcastData>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error("PLAYER_KICKED event not received within timeout")
            );
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.PLAYER_KICKED,
            (data: PlayerKickBroadcastData) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Wait for LEAVE event on showman socket
      const leaveEventPromise = new Promise<GameLeaveEventPayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("LEAVE event not received within timeout"));
          }, 5000);

          setup.showmanSocket.once(
            SocketIOGameEvents.LEAVE,
            (data: GameLeaveEventPayload) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Wait for LEAVE event on player socket (the kicked player should receive it too)
      const playerLeaveEventPromise = new Promise<GameLeaveEventPayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Player LEAVE event not received within timeout"));
          }, 5000);

          playerSocket.once(
            SocketIOGameEvents.LEAVE,
            (data: GameLeaveEventPayload) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Showman kicks the player
      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
        playerId: targetPlayerId,
      });

      // Wait for all events to be received
      const [kickData, leaveData, playerLeaveData] = await Promise.all([
        kickEventPromise,
        leaveEventPromise,
        playerLeaveEventPromise,
      ]);

      // Verify event data
      expect(kickData.playerId).toBe(targetPlayerId);
      expect(leaveData.user).toBe(targetPlayerId);
      expect(playerLeaveData.user).toBe(targetPlayerId);
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });

  it("should end player session in Redis when restricting a player", async () => {
    const userRepo = testEnv.getDatabase().getRepository(User);
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

    try {
      const targetPlayerId = setup.playerUsers[0].id;
      const gameId = setup.gameId;

      // Verify initial session has no leftAt timestamp
      const initialSessionData = await playerGameStatsRepository.getStats(
        gameId,
        targetPlayerId
      );
      expect(initialSessionData).toBeTruthy();
      expect(initialSessionData!.leftAt).toBe("");

      // Wait for PLAYER_RESTRICTED event
      const restrictionEventPromise = utils.waitForEvent(
        setup.showmanSocket,
        SocketIOGameEvents.PLAYER_RESTRICTED
      );

      // Showman restricts the player (should end their session)
      setup.showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
        playerId: targetPlayerId,
        muted: false,
        restricted: true,
        banned: false,
      });

      await restrictionEventPromise;

      // Verify session now has leftAt timestamp (session was ended)
      const finalSessionData = await playerGameStatsRepository.getStats(
        gameId,
        targetPlayerId
      );
      expect(finalSessionData).toBeTruthy();
      expect(finalSessionData!.leftAt).not.toBe("");

      // Verify leftAt is a recent timestamp
      const leftAt = new Date(finalSessionData!.leftAt);
      const now = new Date();
      const timeDiff = now.getTime() - leftAt.getTime();
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    } finally {
      await utils.cleanupGameClients(setup);
    }
  });
});
