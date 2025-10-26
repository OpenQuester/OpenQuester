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
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Socket Game State Tests", () => {
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
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Round Management", () => {
    it("should handle round skip", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      const gameData = await utils.startGame(showmanSocket);
      const orderBeforeSkip = gameData.currentRound.order;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        playerSockets[0].on(
          SocketIOGameEvents.NEXT_ROUND,
          (data: GameNextRoundEventPayload) => {
            clearTimeout(timeout);
            expect(data.gameState).toBeDefined();
            expect(data.gameState.currentRound).toBeDefined();
            expect(data.gameState.currentRound?.order).toBe(
              orderBeforeSkip + 1
            );
            resolve();
          }
        );

        // Progress to next round
        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle game finish", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        playerSockets[0].on(SocketIOGameEvents.NEXT_ROUND, () => {
          // Instant emit of second round skip to trigger game finish
          showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
        });

        playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data: any) => {
          clearTimeout(timeout);
          expect(data).toBe(true);
          resolve();
        });

        // Simulate game finish by forcing next round twice (package has 2 rounds)
        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle game finish via all questions played", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0,
        false
      );
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Skip first round
        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          // Listen for game finish event
          playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data: any) => {
            clearTimeout(timeout);
            expect(data).toBe(true);
            resolve();
          });

          const playQuestion = async () => {
            try {
              // Pick question
              await utils.pickQuestion(showmanSocket);

              // Player answers
              await utils.answerQuestion(playerSockets[0], showmanSocket);

              // Showman counts it as correct answer
              await new Promise<void>((resolveAnswer) => {
                playerSockets[0].once(
                  SocketIOGameEvents.QUESTION_FINISH,
                  () => {
                    resolveAnswer();
                  }
                );

                showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
                  scoreResult: 100,
                  answerType: "correct",
                });
              });

              // Continue to next question immediately
              setTimeout(playQuestion, 100);
            } catch {
              // If we can't pick more questions, the game should finish soon
            }
          };

          // Start playing questions after a short delay
          setTimeout(playQuestion, 250);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle game finish via all questions played (last question skipped)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Skip first round
        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          // Listen for game finish event
          playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data: any) => {
            clearTimeout(timeout);
            expect(data).toBe(true);
            resolve();
          });

          const skipQuestion = async () => {
            try {
              // Pick question
              await utils.pickQuestion(showmanSocket);

              // Skip the question immediately
              showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

              // Continue to next question immediately
              setTimeout(skipQuestion, 100);
            } catch {
              // If we can't pick more questions, the game should finish soon
            }
          };

          // Start skipping questions after a short delay
          setTimeout(skipQuestion, 250);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Game State Synchronization", () => {
    it("should handle game state synchronization for late joiners", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { gameId } = setup;

      // Create a new player that joins mid-game
      const { socket: lateJoinSocket } = await utils.createGameClient(
        app,
        userRepo
      );

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        lateJoinSocket.on(SocketIOGameEvents.GAME_DATA, (data: any) => {
          clearTimeout(timeout);
          expect(data.gameState).toBeDefined();
          expect(data.players).toBeDefined();
          resolve();
        });

        // Join game
        lateJoinSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
        } satisfies GameJoinData);
      }).finally(async () => {
        await utils.disconnectAndCleanup(lateJoinSocket);
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Game Pause Management", () => {
    it("should handle game pause and unpause", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        // Listen for pause event
        playerSockets[0].once(SocketIOGameEvents.GAME_PAUSE, () => {
          // Listen for unpause event after pause
          playerSockets[0].once(
            SocketIOGameEvents.GAME_UNPAUSE,
            (data: any) => {
              clearTimeout(timeout);
              expect(data.timer).toBeDefined();
              resolve();
            }
          );

          // Unpause game after pause
          showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        });

        // Pause game
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should not allow player to pause/unpause game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets } = setup;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 8000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBe("Only showman can pause the game");
          resolve();
        });

        // Try to pause game as player
        playerSockets[0].emit(SocketIOGameEvents.GAME_PAUSE, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    }, 15000);
  });
});
