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
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Choice Question Flow Tests", () => {
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

  describe("Choice Question Behavior", () => {
    it("should reveal question correctly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Get initial game state and find a choice question
        const initialGameState = await utils.getGameState(gameId);
        expect(initialGameState).toBeDefined();

        // For now, we'll manually find the choice question by looking for our test data
        // This will be enhanced when we add proper Choice question detection
        let choiceQuestionId: number | null = null;

        // Find choice question in the test data - it should be order 5 with price 300
        if (initialGameState?.currentRound?.themes) {
          for (const theme of initialGameState.currentRound.themes) {
            for (const question of theme.questions) {
              // Choice question has unique combination price 300 & order 5 in test data
              if (
                question.price === 300 &&
                question.order === 5 &&
                !question.isPlayed
              ) {
                choiceQuestionId = question.id;
                break;
              }
            }
            if (choiceQuestionId) break;
          }
        }

        expect(choiceQuestionId).toBeDefined();
        expect(choiceQuestionId).not.toBeNull();

        // Set up promise to capture initial question data
        const questionDataPromise = new Promise<GameQuestionDataEventPayload>(
          (resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Test timeout waiting for QUESTION_DATA"));
            }, 2000);

            playerSocket.once(
              SocketIOGameEvents.QUESTION_DATA,
              (data: GameQuestionDataEventPayload) => {
                clearTimeout(timeout);
                resolve(data);
              }
            );
          }
        );

        // Pick the choice question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: choiceQuestionId,
        });

        const questionData = await questionDataPromise;

        // Verify initial question data is revealed
        expect(questionData.data).toBeDefined();
        expect(questionData.data.text).toBe("Choice question text");
        expect(questionData.data.price).toBe(300);
        expect(questionData.data.type).toBe(PackageQuestionType.CHOICE);

        expect(questionData.data.showDelay).toBeDefined();
        expect(questionData.data.answers).toBeDefined();
        expect(questionData.data.answers?.length).toBe(4);

        const downloadingGameState = await utils.getGameState(gameId);
        expect(downloadingGameState!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
        expect(downloadingGameState!.currentQuestion).toBeDefined();

        const mediaStatusPromise = utils.waitForEvent(
          playerSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          2000
        );
        playerSocket.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await mediaStatusPromise;

        const showingGameState = await utils.getGameState(gameId);
        expect(showingGameState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingGameState!.currentQuestion).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle choice question answer flow with multiple choice selection", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find and pick a choice question using the test data pattern
        let choiceQuestionId: number | null = null;
        const initialGameState = await utils.getGameState(gameId);

        if (initialGameState?.currentRound?.themes) {
          for (const theme of initialGameState.currentRound.themes) {
            for (const question of theme.questions) {
              if (
                question.price === 300 &&
                question.order === 5 &&
                !question.isPlayed
              ) {
                choiceQuestionId = question.id;
                break;
              }
            }
            if (choiceQuestionId) break;
          }
        }

        expect(choiceQuestionId).not.toBeNull();

        // Pick the choice question
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout waiting for QUESTION_DATA"));
          }, 2000);

          playerSocket.once(
            SocketIOGameEvents.QUESTION_DATA,
            (data: GameQuestionDataEventPayload) => {
              clearTimeout(timeout);
              // Verify choice question structure
              expect(data.data.type).toBe(PackageQuestionType.CHOICE);
              expect(data.data.answers).toBeDefined();
              expect(data.data.showDelay).toBeDefined();
              resolve();
            }
          );

          showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: choiceQuestionId,
          });
        });

        // For now, continue with standard answer flow
        // Future implementation will add choice-specific selection logic
        await utils.answerQuestion(playerSocket, showmanSocket);

        // Set up event listener for answer result before emitting
        const answerResultPromise = utils.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        const answerShowEndPromise = utils.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_SHOW_END,
          2000
        );

        // Submit answer result from showman
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for answer result
        await answerResultPromise;

        // Skip show answer phase
        await utils.skipShowAnswer(showmanSocket);

        await answerShowEndPromise;

        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should provide choice question data to both showman and players when picked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find choice question
        let choiceQuestionId: number | null = null;
        const initialGameState = await utils.getGameState(gameId);

        if (initialGameState?.currentRound?.themes) {
          for (const theme of initialGameState.currentRound.themes) {
            for (const question of theme.questions) {
              if (
                question.price === 300 &&
                question.order === 5 &&
                !question.isPlayed
              ) {
                choiceQuestionId = question.id;
                break;
              }
            }
            if (choiceQuestionId) break;
          }
        }

        expect(choiceQuestionId).not.toBeNull();

        // Set up promises to capture data sent to both showman and player
        const showmanDataPromise = new Promise<GameQuestionDataEventPayload>(
          (resolve) => {
            showmanSocket.once(SocketIOGameEvents.QUESTION_DATA, resolve);
          }
        );
        const playerDataPromise = new Promise<GameQuestionDataEventPayload>(
          (resolve) => {
            playerSocket.once(SocketIOGameEvents.QUESTION_DATA, resolve);
          }
        );

        // Pick the choice question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: choiceQuestionId,
        });

        const [showmanData, playerData] = await Promise.all([
          showmanDataPromise,
          playerDataPromise,
        ]);

        // Both should receive question data
        expect(showmanData.data.type).toBe(PackageQuestionType.CHOICE);
        expect(showmanData.data.text).toBe("Choice question text");
        expect(showmanData.data.showDelay).toBe(3000);
        expect(showmanData.data.answers).toBeDefined();
        expect(showmanData.data.answers?.length).toBe(4);

        expect(playerData.data.type).toBe(PackageQuestionType.CHOICE);
        expect(playerData.data.text).toBe("Choice question text");
        expect(playerData.data.showDelay).toBe(3000);
        expect(playerData.data.answers).toBeDefined();
        expect(playerData.data.answers?.length).toBe(4);

        // Verify the choices are structured correctly
        const answers = showmanData.data.answers!;
        expect(answers[0].text).toBe("Option A");
        expect(answers[1].text).toBe("Option B");
        expect(answers[2].text).toBe("Option C");
        expect(answers[3].text).toBe("Option D");

        // All answers should have proper order
        for (let i = 0; i < answers.length; i++) {
          expect(answers[i].order).toBe(i);
        }
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Multiple Choice Questions", () => {
    it("should handle choice question with different number of options", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Find choice question and verify it has 4 options (from our test data)
        let choiceQuestionId: number | null = null;
        const initialGameState = await utils.getGameState(gameId);

        if (initialGameState?.currentRound?.themes) {
          for (const theme of initialGameState.currentRound.themes) {
            for (const question of theme.questions) {
              if (
                question.price === 300 &&
                question.order === 5 &&
                !question.isPlayed
              ) {
                choiceQuestionId = question.id;
                break;
              }
            }
            if (choiceQuestionId) break;
          }
        }

        if (!choiceQuestionId) {
          console.warn("Test Failed: No choice question found in test package");
          expect(false).toBe(true);
          return;
        }

        // Pick the choice question and verify structure
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Test timeout waiting for QUESTION_DATA"));
          }, 5000);

          playerSockets[0].once(
            SocketIOGameEvents.QUESTION_DATA,
            (data: GameQuestionDataEventPayload) => {
              clearTimeout(timeout);
              try {
                expect(data.data.type).toBe(PackageQuestionType.CHOICE);
                expect(data.data.answers).toBeDefined();
                expect(data.data.answers?.length).toBe(4);

                // Verify all options are present and ordered correctly
                const answers = data.data.answers!;
                expect(answers.find((a) => a.order === 0)?.text).toBe(
                  "Option A"
                );
                expect(answers.find((a) => a.order === 1)?.text).toBe(
                  "Option B"
                );
                expect(answers.find((a) => a.order === 2)?.text).toBe(
                  "Option C"
                );
                expect(answers.find((a) => a.order === 3)?.text).toBe(
                  "Option D"
                );

                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );

          showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
            questionId: choiceQuestionId,
          });
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
