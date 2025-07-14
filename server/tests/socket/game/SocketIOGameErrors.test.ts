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
import { Repository } from "typeorm";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Socket Game Error Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  }, 10000);

  beforeEach(async () => {
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    await redisClient.del(...(await redisClient.keys("*")));

    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }
  }, 5000);

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Game Join Errors", () => {
    it("should reject joining non-existent game", async () => {
      const { socket: testSocket } = await utils.createGameClient(
        app,
        userRepo
      );

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 8000);

        testSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("Game with id 'XXXX' not found");
          resolve();
        });

        testSocket.emit(
          SocketIOGameEvents.JOIN,
          {
            gameId: "XXXX",
            role: PlayerRole.PLAYER,
          } as GameJoinData,
          () => {
            // Error will be handled by the error event listener
          }
        );
      }).finally(async () => {
        await utils.disconnectAndCleanup(testSocket);
      });
    });

    it("should reject joining same game twice", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets } = setup;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("You are already in this game");
          resolve();
        });

        // Try joining the same game again
        playerSockets[0].emit(
          SocketIOGameEvents.JOIN,
          {
            gameId: setup.gameId,
            role: PlayerRole.PLAYER,
          } as GameJoinData,
          () => {
            // Error will be handled by the error event listener
          }
        );
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Connection Error Handling", () => {
    it("should handle multiple rapid join/leave requests", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
      const { gameId } = setup;

      const clients = await Promise.all(
        Array(5)
          .fill(null)
          .map(async () => {
            return await utils.createGameClient(app, userRepo);
          })
      );

      try {
        // Rapidly join and leave
        await Promise.all(
          clients.map(async (client) => {
            await utils.joinGame(client.socket, gameId);
            await utils.leaveGame(client.socket);
            // Ensure socket is properly disconnected
            client.socket.disconnect();
            // Add a small delay to ensure disconnect is processed
            await new Promise((resolve) => setTimeout(resolve, 500));
          })
        );

        // Add a delay before checking connection status
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // All clients should be successfully disconnected
        clients.forEach((client) => {
          expect(client.socket.connected).toBeFalsy();
        });
      } finally {
        // Add a delay before cleanup to ensure all operations are complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await Promise.all(
          clients.map(async (client) => {
            if (client.socket.connected) {
              client.socket.disconnect();
            }
            await utils.disconnectAndCleanup(client.socket);
          })
        );
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle disconnection during game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { playerSockets, showmanSocket } = setup;

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        // Start listening for leave event before disconnecting
        showmanSocket.on(SocketIOGameEvents.LEAVE, (data: any) => {
          clearTimeout(timeout);
          expect(data).toBeDefined();
          resolve();
        });

        // Force disconnect a player
        playerSockets[0].disconnect();
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Game Action Errors", () => {
    it("should handle invalid question picks", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBeDefined();
          resolve();
        });

        // Try to pick invalid question
        showmanSocket.emit(
          SocketIOGameEvents.QUESTION_PICK,
          { questionId: 9999 },
          () => {
            // Error will be handled by the error event listener
          }
        );
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle unauthorized answer submissions", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { playerSockets } = setup;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBeDefined();
          resolve();
        });

        // Try to submit answer result as player
        playerSockets[0].emit(
          SocketIOGameEvents.ANSWER_RESULT,
          {
            scoreResult: 100,
            answerType: "correct",
          },
          () => {
            // Error will be handled by the error event listener
          }
        );
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle starting already started game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      try {
        // Start game normally first
        await utils.startGame(showmanSocket);

        // Verify game is started by checking if currentRound exists
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.currentRound).not.toBeNull();

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 5000);

          showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            error.message.includes("already started");
            resolve();
          });

          // Try to start game again - should emit error
          showmanSocket.emit(SocketIOGameEvents.START, {});
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Game State Errors", () => {
    it("should handle invalid game state transitions", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket } = setup;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBeDefined();
          resolve();
        });

        // Try to skip question without starting game
        showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {}, () => {
          // Error will be handled by the error event listener
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle creating game with invalid package ID", async () => {
      const { socket, cookie } = await utils.createGameClient(app, userRepo);

      try {
        const gameData = {
          title: "Test Game",
          packageId: "invalid-package-id",
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 10,
        };

        const gameRes = await request(app)
          .post("/v1/games")
          .set("Cookie", cookie)
          .send(gameData);

        expect(gameRes.status).not.toBe(200);
        expect(gameRes.body.error || gameRes.body.message).toBeDefined();
      } finally {
        await utils.disconnectAndCleanup(socket);
      }
    });

    it("should handle invalid role actions", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets } = setup;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBeDefined();
          resolve();
        });

        // Try to start game as player
        playerSockets[0].emit(SocketIOGameEvents.START, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });
});
