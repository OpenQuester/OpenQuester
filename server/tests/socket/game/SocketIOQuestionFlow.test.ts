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
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  QuestionFinishEventPayload,
  QuestionFinishWithAnswerEventPayload,
} from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
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

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    // Clear Redis before each test
    const redisClient = RedisConfig.getClient();
    await redisClient.del(...(await redisClient.keys("*")));

    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }
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
        utils.pickQuestion(showmanSocket).catch(reject);
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
        utils.pickQuestion(playerSockets[0]).catch(reject);
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });
  });

  describe("Question Answering", () => {
    it("should handle correct answer submission", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket);
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        playerSockets[0].on(
          SocketIOGameEvents.QUESTION_FINISH,
          (data: QuestionFinishWithAnswerEventPayload) => {
            clearTimeout(timeout);
            expect(data.answerResult).toBeDefined();
            expect(data.answerFiles).toBeDefined();
            expect(data.answerText).toBeDefined();
            resolve();
          }
        );

        // Submit correct answer result
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });
      }).finally(async () => {
        await utils.cleanupGameClients(setup);
      });
    });

    it("should handle incorrect answer submission", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game and pick question
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket);
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
      await utils.pickQuestion(showmanSocket);

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
      await utils.pickQuestion(showmanSocket);

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
        await utils.pickQuestion(showmanSocket);

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
        showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

        const questionFinishData =
          (await questionFinishPromise) as QuestionFinishEventPayload;

        // Verify appropriate conflict resolution
        expect(questionFinishData.answerFiles).toBeDefined();
        expect(questionFinishData.answerText).toBeDefined();

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
        await utils.pickQuestion(showmanSocket, firstQuestionId);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Complete the question with correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for question to finish and return to choosing state
        await utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_FINISH
        );

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
        await utils.pickQuestion(showmanSocket);
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
});
