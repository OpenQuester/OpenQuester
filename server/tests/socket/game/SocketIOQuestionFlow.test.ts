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
import { SocketGameTestUtils } from "./utils/SocketIOGameTestUtils";

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

      return new Promise<void>((resolve, reject) => {
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

      return new Promise<void>((resolve, reject) => {
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

      return new Promise<void>((resolve, reject) => {
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

      return new Promise<void>((resolve, reject) => {
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

      return new Promise<void>((resolve, reject) => {
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

      return new Promise<void>((resolve, reject) => {
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

    it.skip("should handle question skip during answer submission", () => {
      // TODO: Test showman skipping while players are answering
      // Expected: Should handle transition appropriately
      // Flow:
      // 1. Present question to players
      // 2. Players begin answering while showman skips
      // 3. Verify appropriate conflict resolution
      // 4. Verify no lost answers or scoring issues
    });
  });

  describe("Question Selection", () => {
    it.skip("should handle selecting already played question", () => {
      // TODO: Test selecting question that was already answered
      // Expected: Should emit error or prevent selection
      // Flow:
      // 1. Start game and answer a question
      // 2. Attempt to select same question again
      // 3. Verify error handling
    });

    it.skip("should reject question selection from spectator", () => {
      // TODO: After answering player implemented
      // Flow:
      // 1. Player answers a question correctly and get permission to select next question
      // 2. Before question selection player becomes spectator
      // 3. Attempt to select question as spectator
      // 4. Verify that selection is rejected with appropriate error
    });

    it.skip("should handle question selection during wrong game state", () => {
      // TODO: Test selecting question when not in CHOOSING state
      // Expected: Should reject with state error
      // Flow:
      // 1. Start game and advance to ANSWERING state
      // 2. Attempt to select another question
      // 3. Verify state error
    });
  });
});
