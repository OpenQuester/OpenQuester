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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  QuestionSkipBroadcastData,
  QuestionUnskipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Socket Question Flow Tests", () => {
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

  describe("Question Selection", () => {
    it("should allow showman to pick a question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start the game first
      await utils.startGame(showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 8000);

        playerSockets[0].on(SocketIOGameEvents.QUESTION_DATA, (data: any) => {
          clearTimeout(timeout);
          expect(data.data).toBeDefined();
          expect(data.timer).toBeDefined();
          resolve();
        });

        // Pick a question using the helper method to get valid question ID
        utils
          .pickQuestion(showmanSocket, undefined, playerSockets)
          .catch(reject);
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should allow player to pick a question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start the game first
      await utils.startGame(showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 8000);

        playerSockets[0].on(SocketIOGameEvents.QUESTION_DATA, (data: any) => {
          clearTimeout(timeout);
          expect(data.data).toBeDefined();
          expect(data.timer).toBeDefined();
          resolve();
        });

        // Pick a question using the helper method to get valid question ID
        utils
          .pickQuestion(playerSockets[0], undefined, playerSockets)
          .catch(reject);
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Question Answering", () => {
    it("should handle correct answer submission", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answerShowStartPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Set up event listeners BEFORE emitting the answer result
        const answerShowEndPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        // Submit correct answer result
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for state transition to SHOWING_ANSWER
        await answerShowStartPromise;

        // Skip show answer phase immediately for faster test
        await utils.skipShowAnswer(showmanSocket);
        await answerShowEndPromise;

        // Verify question finish data is correct
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle incorrect answer submission", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        playerSockets[0].on(
          SocketIOGameEvents.ANSWER_RESULT,
          (data: QuestionAnswerResultEventPayload) => {
            clearTimeout(timeout);
            expect(data.answerResult).toBeDefined();
            expect(data.answerResult.answerType).toBe(AnswerResultType.WRONG);
            expect(data.answerResult.result).toBe(-100);
            expect(data.timer).toBeDefined();
            resolve();
          }
        );

        // Submit wrong answer result
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Question Control", () => {
    it("should handle question skipping", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        playerSockets[0].on(
          SocketIOGameEvents.QUESTION_FINISH,
          (data: QuestionFinishEventPayload) => {
            clearTimeout(timeout);
            expect(data.answerFiles).toBeDefined();
            expect(data.answerText).toBeDefined();
            resolve();
          }
        );

        // Skip question
        showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle simultaneous answer attempts", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      await new Promise<void>((resolve, reject) => {
        const errorTimeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        let answerCount = 0;
        showmanSocket.on(SocketIOGameEvents.QUESTION_ANSWER, () => {
          answerCount++;
        });

        // Check that server rejects multiple answers attempts, only first one is valid
        setTimeout(() => {
          expect(answerCount).toBe(1);
          clearTimeout(errorTimeout);
          resolve();
        }, 500);

        // Multiple players try to answer simultaneously
        playerSockets.forEach((socket) => {
          socket.emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle question skip during answer submission", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Present question to players
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player begins answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify player is answering
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Showman skips while player is answering
        const questionFinishPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );
        const showAnswerStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );
        showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

        const questionFinishData =
          (await questionFinishPromise) as QuestionFinishEventPayload;

        // Verify appropriate conflict resolution
        expect(questionFinishData.answerFiles).toBeDefined();
        expect(questionFinishData.answerText).toBeDefined();

        // Wait for SHOWING_ANSWER phase and skip it
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify game transitions properly and no scoring issues
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.answeringPlayer).toBeNull();
        expect(finalState!.currentQuestion).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Question Selection", () => {
    it("should handle selecting already played question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game and answer a question
        await utils.startGame(showmanSocket);
        const firstQuestionId = await utils.getFirstAvailableQuestionId(
          setup.gameId
        );
        await utils.pickQuestion(showmanSocket, firstQuestionId, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Complete the question with correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });
        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        const answerShowEndPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        // Wait for state transition to SHOWING_ANSWER before skipping
        await answerShowStartPromise;

        await utils.skipShowAnswer(showmanSocket);
        await answerShowEndPromise;

        // Verify we're back in choosing state
        const choosingState = await utils.getGameState(setup.gameId);
        expect(choosingState).toBeDefined();
        expect(choosingState!.questionState).toBe(QuestionState.CHOOSING);
        expect(choosingState!.currentQuestion).toBeNull();

        // Attempt to select same question again - should emit error
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR
        );
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: firstQuestionId,
        });

        const error = await errorPromise;
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.message).toContain("already played");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject question selection from spectator", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
      const { showmanSocket, spectatorSockets } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Verify we're in choosing state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);

        // Spectator attempts to select question - should be rejected
        const errorPromise = utils.waitForEvent(
          spectatorSockets[0],
          SocketIOEvents.ERROR
        );
        const questionId = await utils.getFirstAvailableQuestionId(
          setup.gameId
        );
        spectatorSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: questionId,
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
        expect(error.message).toContain("cannot pick question");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle question selection during wrong game state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        // Start game and advance to ANSWERING state
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Attempt to select another question while in wrong state
        const errorPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOEvents.ERROR
        );
        const anotherQuestionId = await utils.getFirstAvailableQuestionId(
          setup.gameId
        );
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: anotherQuestionId,
        });

        const error = await errorPromise;
        expect(error.message).toBeDefined();
        expect(error.message).toContain("already picked");
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Turn Player Rotation", () => {
    it("should send nextTurnPlayerId in QUESTION_FINISH and rotate turn after correct answer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Get initial turn player
      let gameState = await utils.getGameState(gameId);
      expect(gameState?.currentTurnPlayerId).toBeDefined();
      const initialTurnPlayer = gameState!.currentTurnPlayerId;

      // Pick a player who is NOT the current turn player
      const nextPlayerSocket = playerSockets.find(
        (_s, i) => setup.playerUsers[i].id !== initialTurnPlayer
      );
      const nextPlayerId =
        setup.playerUsers[playerSockets.indexOf(nextPlayerSocket!)].id;

      // That player answers
      await utils.answerQuestion(nextPlayerSocket!, showmanSocket);

      // Set up listener for QUESTION_FINISH event BEFORE emitting answer result
      // QUESTION_FINISH contains the nextTurnPlayerId after a correct answer
      const questionFinishPromise = new Promise<{ nextTurnPlayerId: number }>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timeout waiting for QUESTION_FINISH")),
            5000
          );
          nextPlayerSocket!.once(
            SocketIOGameEvents.QUESTION_FINISH,
            (data: { nextTurnPlayerId: number }) => {
              clearTimeout(timeout);
              resolve(data);
            }
          );
        }
      );

      // Submit correct answer result
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: 100,
        answerType: AnswerResultType.CORRECT,
      });

      // Wait for QUESTION_FINISH with nextTurnPlayerId
      const questionFinishData = await questionFinishPromise;
      expect(questionFinishData.nextTurnPlayerId).toBeDefined();
      expect(questionFinishData.nextTurnPlayerId).toBe(nextPlayerId);

      // Skip show answer phase for faster test
      await utils.skipShowAnswer(showmanSocket);

      // Also check game state updated
      gameState = await utils.getGameState(gameId);
      expect(gameState!.currentTurnPlayerId).toBe(nextPlayerId);
      await utils.cleanupGameClients(setup);
    });

    it("should set a random initial currentTurnPlayerId on game start", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);

      const { showmanSocket, gameId } = setup;
      await utils.startGame(showmanSocket);

      const gameState = await utils.getGameState(gameId);
      expect(gameState?.currentTurnPlayerId).toBeDefined();

      const playerIds = setup.playerUsers.map((u) => u.id);
      expect(playerIds).toContain(gameState!.currentTurnPlayerId);

      await utils.cleanupGameClients(setup);
    });

    it("should rotate currentTurnPlayerId to the player who answers correctly (if not already their turn)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Get initial turn player
      let gameState = await utils.getGameState(gameId);
      expect(gameState?.currentTurnPlayerId).toBeDefined();

      const initialTurnPlayer = gameState!.currentTurnPlayerId;
      // Pick a player who is NOT the current turn player
      const nextPlayerSocket = playerSockets.find(
        (_s, i) => setup.playerUsers[i].id !== initialTurnPlayer
      );
      const nextPlayerId =
        setup.playerUsers[playerSockets.indexOf(nextPlayerSocket!)].id;

      // That player answers
      await utils.answerQuestion(nextPlayerSocket!, showmanSocket);

      // Wait for ANSWER_RESULT event (correct answer)
      const answerResultPromise = utils.waitForEvent(
        nextPlayerSocket!,
        SocketIOGameEvents.ANSWER_RESULT
      );
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: 100,
        answerType: AnswerResultType.CORRECT,
      });
      await answerResultPromise;

      gameState = await utils.getGameState(gameId);
      expect(gameState!.currentTurnPlayerId).toBe(nextPlayerId);
      await utils.cleanupGameClients(setup);
    });

    it("should NOT rotate currentTurnPlayerId if the current turn player answers correctly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      let gameState = await utils.getGameState(gameId);
      expect(gameState?.currentTurnPlayerId).toBeDefined();

      const initialTurnPlayer = gameState!.currentTurnPlayerId;
      const currentPlayerSocket = playerSockets.find(
        (_s, i) => setup.playerUsers[i].id === initialTurnPlayer
      );

      // That player answers
      await utils.answerQuestion(currentPlayerSocket!, showmanSocket);

      // Wait for ANSWER_RESULT event (correct answer)
      const answerResultPromise = utils.waitForEvent(
        currentPlayerSocket!,
        SocketIOGameEvents.ANSWER_RESULT
      );
      showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
        scoreResult: 100,
        answerType: AnswerResultType.CORRECT,
      });
      await answerResultPromise;

      gameState = await utils.getGameState(gameId);
      expect(gameState!.currentTurnPlayerId).toBe(initialTurnPlayer);
      await utils.cleanupGameClients(setup);
    });
  });

  describe("Player Skip Mechanism", () => {
    it("should allow player to skip question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        showmanSocket.on(
          SocketIOGameEvents.QUESTION_SKIP,
          (data: QuestionSkipBroadcastData) => {
            clearTimeout(timeout);
            expect(data.playerId).toBe(setup.playerUsers[0].id);
            resolve();
          }
        );

        // Player skips question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should allow player to unskip question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // First skip the question
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      });

      // Then unskip it
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        showmanSocket.on(
          SocketIOGameEvents.QUESTION_UNSKIP,
          (data: QuestionUnskipBroadcastData) => {
            clearTimeout(timeout);
            expect(data.playerId).toBe(setup.playerUsers[0].id);
            resolve();
          }
        );

        // Player unskips question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_UNSKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should prevent non-players from skipping", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1);
      const { showmanSocket, playerSockets, spectatorSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 10000);

        spectatorSockets[0].on(
          SocketIOEvents.ERROR,
          (error: { message: string }) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            expect(error.message.toLowerCase()).toContain(
              "only players can skip"
            );
            resolve();
          }
        );

        // Spectator tries to skip question - should fail
        spectatorSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should prevent player from skipping while answering", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Player begins answering
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        playerSockets[0].on(
          SocketIOEvents.ERROR,
          (error: { message: string }) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            expect(error.message.toLowerCase()).toContain(
              "cannot skip while answering"
            );
            resolve();
          }
        );

        // Player tries to skip while answering - should fail
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should prevent player from skipping if already answered", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // First player answers
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      // Showman gives result
      await new Promise<void>((resolve) => {
        playerSockets[0].once(SocketIOGameEvents.ANSWER_RESULT, resolve);
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        playerSockets[0].on(
          SocketIOEvents.ERROR,
          (error: { message: string }) => {
            clearTimeout(timeout);
            expect(error.message).toBeDefined();
            expect(error.message.toLowerCase()).toContain("already answered");
            resolve();
          }
        );

        // Player tries to skip after he answered - should fail
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should prevent unskipping when player hasn't skipped", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        playerSockets[0].on(SocketIOEvents.ERROR, (error: any) => {
          clearTimeout(timeout);
          expect(error.message).toBeDefined();
          expect(error.message).toContain("has not skipped");
          resolve();
        });

        // Player tries to unskip without skipping first - should fail
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_UNSKIP, {});
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should automatically skip question when all players have skipped", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      let skipCount = 0;

      // Listen for individual player skips on showman socket
      showmanSocket.on(SocketIOGameEvents.QUESTION_SKIP, (_data: any) => {
        skipCount++;
      });

      // Listen for automatic question finish when all players skip
      const questionFinishPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 2000);

        showmanSocket.on(
          SocketIOGameEvents.QUESTION_FINISH,
          (data: QuestionFinishEventPayload) => {
            clearTimeout(timeout);
            expect(data.answerFiles).toBeDefined();
            expect(data.answerText).toBeDefined();
            expect(skipCount).toBe(3);
            resolve();
          }
        );
      });

      // All players skip the question sequentially
      for (let i = 0; i < playerSockets.length; i++) {
        await new Promise<void>((resolve) => {
          showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
          playerSockets[i].emit(SocketIOGameEvents.QUESTION_SKIP, {});
        });
      }

      await questionFinishPromise;
      await utils.cleanupGameClients(setup);
    });

    it("should update game state with skipped players", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // First player skips
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      });

      // Check game state has been updated
      let gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.skippedPlayers).toBeDefined();
      expect(gameState!.skippedPlayers).not.toBeNull();
      expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);
      expect(gameState!.skippedPlayers).toHaveLength(1);

      // Second player skips
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
        playerSockets[1].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      });

      // Check game state has both players (but not all players, so no auto-skip)
      gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.skippedPlayers).toBeDefined();
      expect(gameState!.skippedPlayers).not.toBeNull();
      expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);
      expect(gameState!.skippedPlayers).toContain(setup.playerUsers[1].id);
      expect(gameState!.skippedPlayers).toHaveLength(2);

      await utils.cleanupGameClients(setup);
    });

    it("should remove player from skipped list when unskipping", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Two players skip (not all players, so no automatic skip)
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      });

      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_SKIP, resolve);
        playerSockets[1].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      });

      // First player unskips
      await new Promise<void>((resolve) => {
        showmanSocket.once(SocketIOGameEvents.QUESTION_UNSKIP, resolve);
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_UNSKIP, {});
      });

      // Check game state - only second player should be in skipped list
      const gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.skippedPlayers).toBeDefined();
      expect(gameState!.skippedPlayers).not.toBeNull();
      expect(gameState!.skippedPlayers).not.toContain(setup.playerUsers[0].id);
      expect(gameState!.skippedPlayers).toContain(setup.playerUsers[1].id);
      expect(gameState!.skippedPlayers).toHaveLength(1);

      await utils.cleanupGameClients(setup);
    });

    it("should reset skipped players when question finishes", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      expect((await utils.getGameState(setup.gameId))?.questionState).toBe(
        QuestionState.SHOWING
      );

      // Player skips
      const skipPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.QUESTION_SKIP
      );
      playerSockets[0].emit(SocketIOGameEvents.QUESTION_SKIP, {});
      await skipPromise;

      // Verify player is in skipped list
      let gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.skippedPlayers).toBeDefined();
      expect(gameState!.skippedPlayers).toContain(setup.playerUsers[0].id);

      // Showman force skips question
      const forceSkipPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_FINISH
      );
      const showAnswerStartPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.ANSWER_SHOW_START
      );
      showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
      await forceSkipPromise;
      await showAnswerStartPromise;
      await utils.skipShowAnswer(showmanSocket);

      // Check that skipped players list is cleared
      gameState = await utils.getGameState(setup.gameId);
      expect(gameState?.skippedPlayers).toBeNull();

      await utils.cleanupGameClients(setup);
    });
  });
});
