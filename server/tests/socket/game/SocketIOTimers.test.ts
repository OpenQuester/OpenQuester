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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

describe("SocketIOTimers", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let socketUtils: SocketGameTestUtils;
  let testUtils: TestUtils;
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
    socketUtils = new SocketGameTestUtils(serverUrl);
    testUtils = new TestUtils(app, userRepo, serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Standard Round Timers", () => {
    it("should handle answer timer expiration with wrong answer", async () => {
      const setup = await socketUtils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick a question
        await socketUtils.startGame(showmanSocket);
        await socketUtils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player starts answering to get into ANSWERING state
        await socketUtils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify game is in ANSWERING state with timer
        const answeringState = await socketUtils.getGameState(gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();
        expect(answeringState!.timer).toBeDefined();

        // Set up event listener for answer result
        const answerResultPromise =
          socketUtils.waitForEvent<QuestionAnswerResultEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_RESULT,
            1000
          );

        // Expire the timer to trigger automatic wrong answer
        await testUtils.expireTimer(gameId);

        // Wait for the timer expiration event
        const answerResult = await answerResultPromise;

        // Verify the auto-timeout resulted in wrong answer
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(
          AnswerResultType.WRONG
        );
        expect(answerResult.answerResult.result).toBeLessThan(0);

        const stateTransitioned = await testUtils.waitForCondition(
          async () => {
            const state = await socketUtils.getGameState(gameId);
            return state!.questionState === QuestionState.SHOWING;
          },
          2000,
          50
        );
        expect(stateTransitioned).toBe(true);

        // Verify game state left ANSWERING and answering player is cleared
        const finalState = await socketUtils.getGameState(gameId);
        expect(finalState!.answeringPlayer).toBeNull();
      } finally {
        await socketUtils.cleanupGameClients(setup);
      }
    });

    it("should handle showing timer expiration leading to next round", async () => {
      const setup = await socketUtils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game
        await socketUtils.startGame(showmanSocket);

        // Pick a question to get into SHOWING state
        await socketUtils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state
        const showingState = await socketUtils.getGameState(gameId);
        expect(showingState!.questionState).toBe(QuestionState.SHOWING);

        // NOW mark all other questions as played to simulate end of round scenario
        const game = await socketUtils.getGameFromGameService(gameId);
        if (game.gameState.currentRound) {
          const themes = game.gameState.currentRound.themes;
          for (let themeIdx = 0; themeIdx < themes.length; themeIdx++) {
            const theme = themes[themeIdx];
            for (let qIdx = 0; qIdx < theme.questions.length; qIdx++) {
              // Mark all questions as played except the currently playing one
              const currentQ = game.gameState.currentQuestion;
              if (currentQ && theme.questions[qIdx].id !== currentQ.id) {
                theme.questions[qIdx].isPlayed = true;
              }
            }
          }
        }
        await socketUtils.updateGame(game);

        // Verify all questions except current are played
        const updatedState = await socketUtils.getGameState(gameId);
        const currentQuestion = updatedState!.currentQuestion;
        expect(currentQuestion).not.toBeNull();

        // Set up event listener for next round (should happen after showing timer expires)
        const nextRoundPromise =
          socketUtils.waitForEvent<GameNextRoundEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.NEXT_ROUND,
            1000
          );

        // Expire showing timer - this should trigger round progression since all questions are played
        await testUtils.expireTimer(gameId);

        // Wait for round progression
        const nextRound = await nextRoundPromise;

        // Verify round progression occurred
        expect(nextRound).toBeDefined();
        expect(nextRound.gameState).toBeDefined();
        expect(nextRound.gameState.currentRound).toBeDefined();
        expect(nextRound.gameState.currentRound!.order).toBeGreaterThan(0);
      } finally {
        await socketUtils.cleanupGameClients(setup);
      }
    });

    it("should handle showing timer expiration with question finish", async () => {
      const setup = await socketUtils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick a question to get to SHOWING state
        await socketUtils.startGame(showmanSocket);
        await socketUtils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state
        const showingState = await socketUtils.getGameState(gameId);
        expect(showingState!.questionState).toBe(QuestionState.SHOWING);

        // Set up event listener for question finish (normal showing timer expiration)
        const questionFinishPromise = socketUtils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH,
          1000
        );

        // Expire showing timer - this should trigger question finish and return to choosing
        await testUtils.expireTimer(gameId);

        // Verify question finish event was received
        await questionFinishPromise;

        // Verify game returned to choosing state
        const finalState = await socketUtils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.currentQuestion).toBeNull();
      } finally {
        await socketUtils.cleanupGameClients(setup);
      }
    });
  });
});
