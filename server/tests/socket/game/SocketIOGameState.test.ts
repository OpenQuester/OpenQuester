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
import { GameJoinInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
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
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
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
          let gameFinished = false;
          let playQuestionTimeout: NodeJS.Timeout | null = null;
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout"));
          }, 2000);

          // Listen for game finish event
          playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data: any) => {
            gameFinished = true;
            clearTimeout(timeout);
            if (playQuestionTimeout) {
              clearTimeout(playQuestionTimeout);
              playQuestionTimeout = null;
            }
            expect(data).toBe(true);
            resolve();
          });

          const playQuestion = async () => {
            // Stop recursion if game has finished
            if (gameFinished) {
              return;
            }

            try {
              // Pick question
              await utils.pickQuestion(showmanSocket, undefined, playerSockets);

              // Player answers
              await utils.answerQuestion(playerSockets[0], showmanSocket);

              // Showman counts it as correct answer
              await new Promise<void>((resolveAnswer) => {
                // Wait for ANSWER_SHOW_START first, then skip the show answer phase
                playerSockets[0].once(
                  SocketIOGameEvents.ANSWER_SHOW_START,
                  () => {
                    // Skip show answer phase for faster test
                    showmanSocket.once(
                      SocketIOGameEvents.ANSWER_SHOW_END,
                      () => {
                        resolveAnswer();
                      }
                    );
                    showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);
                  }
                );

                showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
                  scoreResult: 100,
                  answerType: "correct",
                });
              });

              // Continue to next question after show answer phase (only if game not finished)
              if (!gameFinished) {
                playQuestionTimeout = setTimeout(playQuestion, 100);
              }
            } catch {
              // If we can't pick more questions, the game should finish soon
            }
          };

          // Start playing questions after a short delay
          playQuestionTimeout = setTimeout(playQuestion, 250);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle game finish via all questions played (last question skipped)", async () => {
      // Setup game WITHOUT final round so completion of regular questions finishes the game
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0,
        false
      );
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);
        await utils.setPlayerScore(gameId, playerUsers[0].id, 10000);
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get all questions ordered
        const questions = await utils.getAllAvailableQuestionIds(gameId);
        expect(questions.length).toBeGreaterThan(0);

        showmanSocket.on(SocketIOEvents.ERROR, (error: any) => {
          console.error("Showman socket error:", error);
        });
        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          console.error("Player socket error:", error);
        });
        playerSockets[1]?.on(SocketIOEvents.ERROR, (error: any) => {
          console.error("Player2 socket error:", error);
        });
        playerSockets[2]?.on(SocketIOEvents.ERROR, (error: any) => {
          console.error("Player3 socket error:", error);
        });

        // --- ROUND 1 ---
        // Play all questions except the last one in Round 1
        for (let i = 0; i < questions.length - 1; i++) {
          await utils.pickAndCompleteQuestion(
            showmanSocket,
            playerSockets,
            questions[i],
            true,
            AnswerResultType.CORRECT,
            100,
            0
          );
        }

        // Setup listener for next round BEFORE playing the last question
        const nextRoundPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.NEXT_ROUND
        );

        // Play the last question of Round 1
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          questions[questions.length - 1],
          true,
          AnswerResultType.CORRECT,
          100,
          0
        );

        // Wait for next round transition
        await nextRoundPromise; // --- ROUND 2 ---
        // Get questions for Round 2
        const round2Questions = await utils.getAllAvailableQuestionIds(gameId);
        expect(round2Questions.length).toBeGreaterThan(0);

        // Play all questions except the last one in Round 2
        for (let i = 0; i < round2Questions.length - 1; i++) {
          await utils.pickAndCompleteQuestion(
            showmanSocket,
            playerSockets,
            round2Questions[i],
            true,
            AnswerResultType.CORRECT,
            100,
            0
          );
        }

        // For the last question of Round 2, pick it then skip it
        const lastQuestionId = round2Questions[round2Questions.length - 1];

        // Setup listener for game finish
        const gameFinishedPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.GAME_FINISHED
        );

        await utils.pickQuestion(showmanSocket, lastQuestionId, playerSockets);

        const showAnswerStart = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Skip the last question
        await utils.skipQuestion(showmanSocket);
        await showAnswerStart;
        await utils.skipShowAnswer(showmanSocket);

        // Verify game finished
        await gameFinishedPromise;
        const game = await utils.getGameFromGameService(gameId);
        expect(game?.finishedAt).toBeTruthy();
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
          targetSlot: null,
        } satisfies GameJoinInputData);
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
