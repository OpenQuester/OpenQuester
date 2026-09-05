import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Hidden Question Flow Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Hidden Question Behavior", () => {
    it("should hide price in game state but reveal it when picked", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        // Find a hidden question in the themes
        const hiddenQuestion = await utils.findQuestionByType(PackageQuestionType.HIDDEN, gameId);

        expect(hiddenQuestion).toBeDefined();
        expect(hiddenQuestion!.price).toBeNull(); // Price should be hidden in game state

        // Get the actual question ID to pick
        const hiddenQuestionId = hiddenQuestion!.id;

        const hiddenQuestionDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          playerSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const [, hiddenQuestionData] = await Promise.all([
          utils.pickQuestion(showmanSocket, hiddenQuestionId, playerSockets),
          hiddenQuestionDataPromise
        ]);

        // Verify that the question data now reveals the actual price
        expect(hiddenQuestionData.data).toBeDefined();
        expect(hiddenQuestionData.data.price).toBeDefined();
        expect(hiddenQuestionData.data.price).not.toBeNull();
        expect(typeof hiddenQuestionData.data.price).toBe("number");
        expect(hiddenQuestionData.data.price).toBeGreaterThan(0);

        // Verify this is indeed a hidden question
        expect(hiddenQuestionData.data.type).toBe(PackageQuestionType.HIDDEN);
        expect(hiddenQuestionData.data.isHidden).toBe(true);

        // Verify game state shows we're now showing the question
        const showingGameState = await utils.getGameState(gameId);
        expect(showingGameState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingGameState!.currentQuestion).toBeDefined();
        expect(showingGameState!.currentQuestion!.price).toBeDefined();
        expect(showingGameState!.currentQuestion!.price).not.toBeNull();
      });
    });

    it("should handle hidden question answer flow normally after revealing price", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        // Find and pick a hidden question using the helper method
        const hiddenQuestionId = await utils.getFirstHiddenQuestionId(gameId);
        await utils.pickQuestion(showmanSocket, hiddenQuestionId, playerSockets);

        // Verify we can answer the hidden question normally
        await utils.answerQuestion(playerSocket, showmanSocket);

        // Set up event listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Submit answer result from showman
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result
        await answerResultPromise;

        // Skip show answer phase and wait for end
        await utils.skipShowAnswer(showmanSocket);

        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState!.questionState).toBe(QuestionState.CHOOSING);
      });
    });

    it("should show hidden question data to both showman and players when picked", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        // Find a hidden question
        const hiddenQuestionId = await utils.getFirstHiddenQuestionId(gameId);

        // Set up promises to capture data sent to both showman and player
        const showmanDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );
        const playerDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          playerSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        // Pick the hidden question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: hiddenQuestionId
        });

        const [showmanData, playerData] = await Promise.all([
          showmanDataPromise,
          playerDataPromise
        ]);

        // Both should receive question data with revealed price
        expect(showmanData.data.price).toBeDefined();
        expect(showmanData.data.price).not.toBeNull();
        expect(playerData.data.price).toBeDefined();
        expect(playerData.data.price).not.toBeNull();

        // Prices should be the same
        expect(showmanData.data.price).toBe(playerData.data.price);

        // Both should recognize it as a hidden question
        expect(showmanData.data.type).toBe(PackageQuestionType.HIDDEN);
        expect(showmanData.data.isHidden).toBe(true);
        expect(playerData.data.type).toBe(PackageQuestionType.HIDDEN);
        expect(playerData.data.isHidden).toBe(true);
      });
    });
  });

  describe("Multiple Hidden Questions", () => {
    it("should handle multiple hidden questions independently", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;
        const playerSocket = playerSockets[0];

        // Start game
        await utils.startGame(showmanSocket);

        const initialGameState = await utils.getGameState(gameId);

        // Find all hidden questions
        const hiddenQuestions = await utils.findAllQuestionsByType(
          initialGameState!,
          PackageQuestionType.HIDDEN,
          gameId
        );

        if (hiddenQuestions.length < 2) {
          throw new Error("Expected at least two hidden questions in the test package");
        }

        // Verify all hidden questions have null prices initially
        for (const hiddenQ of hiddenQuestions) {
          expect(hiddenQ.price).toBeNull();
        }

        // Pick first hidden question and verify price is revealed
        await utils.pickQuestion(showmanSocket, hiddenQuestions[0].id, playerSockets);

        // Complete the first question
        await utils.answerQuestion(playerSocket, showmanSocket);

        // Set up listeners before emitting
        const answerResultPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );
        const answerShowStartPromise = scenario.waitForEvent(
          playerSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 100,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result and show answer start before skipping
        await answerResultPromise;
        await answerShowStartPromise;

        // Skip show answer phase
        await utils.skipShowAnswer(showmanSocket);

        // Verify we're back to choosing state
        const afterFirstState = await utils.getGameState(gameId);
        expect(afterFirstState!.questionState).toBe(QuestionState.CHOOSING);

        // Check that remaining hidden questions still have null price in game state
        const remainingHiddenQuestions = await utils.findAllQuestionsByType(
          afterFirstState!,
          PackageQuestionType.HIDDEN,
          gameId
        );

        const unplayedHiddenQuestion = remainingHiddenQuestions.find((q) => !q.isPlayed);
        if (!unplayedHiddenQuestion) {
          throw new Error("Expected an unplayed hidden question after completing the first one");
        }
        expect(unplayedHiddenQuestion.price).toBeNull();
      });
    });
  });
});
