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

import { SHOW_ANSWER_DURATION_TEXT } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  AnswerShowEndEventPayload,
  AnswerShowStartEventPayload,
} from "domain/types/socket/events/game/AnswerShowEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TestUtils } from "tests/utils/TestUtils";

describe("Show Answer Flow Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
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
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new SocketGameTestUtils(serverUrl);
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

  describe("Correct Answer - Show Answer Flow", () => {
    it("should transition to SHOWING_ANSWER state after correct answer", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event (now empty payload - just a signal)
        const answerShowStartPromise =
          utils.waitForEvent<AnswerShowStartEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_SHOW_START,
            5000
          );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event (empty signal)
        const answerShowData = await answerShowStartPromise;

        // Verify event payload is empty (just a transition signal)
        expect(answerShowData).toEqual({});

        // Verify game is in SHOWING_ANSWER state
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
        expect(gameState!.timer).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should send ANSWER_SHOW_END and transition to CHOOSING after show answer timer expires", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event
        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          5000
        );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event
        await answerShowStartPromise;

        // Verify game is in SHOWING_ANSWER state
        let gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);

        // Set up listener for ANSWER_SHOW_END event
        const answerShowEndPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_END,
          1000
        );

        // Expire the timer
        await testUtils.expireTimer(gameId);

        // Wait for ANSWER_SHOW_END event
        const answerShowEndData = await answerShowEndPromise;
        expect(answerShowEndData).toEqual({}); // Empty payload - just a transition signal

        // Verify game is in CHOOSING state
        gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
        expect(gameState!.currentQuestion).toBeNull();
        expect(gameState!.timer).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should transition to SHOWING_ANSWER when all players exhausted after wrong answer", async () => {
      // Note: In a 1-player game, when the only player answers wrong,
      // they are exhausted and the game should transition to SHOWING_ANSWER
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event (now empty payload)
        const answerShowStartPromise =
          utils.waitForEvent<AnswerShowStartEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_SHOW_START,
            5000
          );

        // Submit wrong answer - in 1 player game, player is exhausted after 1 wrong answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });

        // Wait for ANSWER_SHOW_START event (because all players are exhausted)
        const answerShowData = await answerShowStartPromise;

        // Verify event payload is empty (just a transition signal)
        expect(answerShowData).toEqual({});

        // Verify game is in SHOWING_ANSWER state (since single player was exhausted)
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should continue question showing after wrong answer when other players can still answer", async () => {
      // 2-player game: when one player answers wrong, the other player can still answer
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_RESULT event
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          5000
        );

        // Submit wrong answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -100,
          answerType: AnswerResultType.WRONG,
        });

        // Wait for ANSWER_RESULT event
        const answerResultData = await answerResultPromise;

        // Verify event payload - should return timer for continuing SHOWING
        expect(answerResultData.answerResult).toBeDefined();
        expect(answerResultData.answerResult.answerType).toBe(
          AnswerResultType.WRONG
        );
        expect(answerResultData.timer).toBeDefined();

        // Verify game is back in SHOWING state (not SHOWING_ANSWER)
        // because player 1 can still answer
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Show Answer Timer Duration", () => {
    it("should use default text duration (5 seconds) for text-only question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event (now empty payload)
        const answerShowStartPromise =
          utils.waitForEvent<AnswerShowStartEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_SHOW_START,
            5000
          );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event
        const answerShowData = await answerShowStartPromise;

        // Verify event payload is empty (just a transition signal)
        // Timer duration is now determined on server side and can be verified via gameState
        expect(answerShowData).toEqual({});

        // Verify game has the timer with expected duration
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.timer?.durationMs).toBe(SHOW_ANSWER_DURATION_TEXT);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Round Progression After Show Answer", () => {
    it("should progress to next round after show answer timer when all questions played", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;
      const gameId = setup.gameId;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Mark all other questions as played to simulate end of round
        const game = await utils.getGameFromGameService(gameId);
        if (game.gameState.currentRound) {
          const themes = game.gameState.currentRound.themes;
          for (let themeIdx = 0; themeIdx < themes.length; themeIdx++) {
            const theme = themes[themeIdx];
            for (let qIdx = 0; qIdx < theme.questions.length; qIdx++) {
              const currentQ = game.gameState.currentQuestion;
              if (currentQ && theme.questions[qIdx].id !== currentQ.id) {
                theme.questions[qIdx].isPlayed = true;
              }
            }
          }
        }
        await utils.updateGame(game);

        // Answer the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event
        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          5000
        );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event
        await answerShowStartPromise;

        // Verify game is in SHOWING_ANSWER state
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);

        // Set up listener for NEXT_ROUND event (should come after ANSWER_SHOW_END)
        const nextRoundPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.NEXT_ROUND,
          1000
        );

        // Expire the timer
        await testUtils.expireTimer(gameId);

        // Wait for NEXT_ROUND event (game should progress since all questions are played)
        await nextRoundPromise;
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Skip Show Answer", () => {
    it("should allow showman to skip the show-answer phase", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event
        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          5000
        );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event
        await answerShowStartPromise;

        // Verify game is in SHOWING_ANSWER state
        let gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);

        // Set up listener for ANSWER_SHOW_END event
        const answerShowEndPromise =
          utils.waitForEvent<AnswerShowEndEventPayload>(
            playerSockets[0],
            SocketIOGameEvents.ANSWER_SHOW_END,
            5000
          );

        // Skip show-answer phase
        showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);

        // Wait for ANSWER_SHOW_END event
        const answerShowEndData = await answerShowEndPromise;
        // ANSWER_SHOW_END is now an empty payload (transition signal only)
        expect(answerShowEndData).toEqual({});

        // Verify game returned to CHOOSING state
        gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject skip-show-answer from non-showman player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for ANSWER_SHOW_START event
        const answerShowStartPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          5000
        );

        // Submit correct answer
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for ANSWER_SHOW_START event
        await answerShowStartPromise;

        // Verify game is in SHOWING_ANSWER state
        let gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);

        // Set up listener for error event
        const errorPromise = utils.waitForEvent(
          playerSockets[0],
          "error",
          1000
        );

        // Player tries to skip (should fail)
        playerSockets[0].emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);

        // Wait for error
        const errorData = await errorPromise;
        expect(errorData).toBeDefined();

        // Verify game is still in SHOWING_ANSWER state
        gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING_ANSWER);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should reject skip-show-answer when not in SHOWING_ANSWER state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in READING state (not SHOWING_ANSWER)
        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).not.toBe(QuestionState.SHOWING_ANSWER);

        // Set up listener for error event
        const errorPromise = utils.waitForEvent(showmanSocket, "error", 1000);

        // Showman tries to skip show-answer when not in correct state (should fail)
        showmanSocket.emit(SocketIOGameEvents.SKIP_SHOW_ANSWER);

        // Wait for error
        const errorData = await errorPromise;
        expect(errorData).toBeDefined();

        // Verify game state hasn't changed
        const newGameState = await utils.getGameState(gameId);
        expect(newGameState!.questionState).toBe(gameState!.questionState);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
