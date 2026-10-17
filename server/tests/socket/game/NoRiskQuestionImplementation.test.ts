import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("NoRisk Question Implementation", () => {
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

  describe("NoRisk question prevents score loss on wrong answers", () => {
    it.each([
      ["player", "give up"],
      ["showman", "wrong"],
      ["player", "timeout"]
    ])(
      "reserves a %s-picked question for the turn player and ends it on %s",
      async (picker, outcome) => {
        await suite.scenario(async (scenario) => {
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
          const { showmanSocket, playerSockets, playerUsers, gameId } = setup;
          await utils.startGame(showmanSocket);
          const state = await utils.getGameState(gameId);
          const ownerIndex = playerUsers.findIndex((p) => p.id === state!.currentTurnPlayerId);
          const owner = playerSockets[ownerIndex];
          const other = playerSockets[1 - ownerIndex];
          const ownerId = playerUsers[ownerIndex].id;
          const question = (await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId))!;
          const questionData = scenario.waitForEvent<GameQuestionDataEventPayload>(
            other,
            SocketIOGameEvents.QUESTION_DATA
          );
          await utils.pickQuestion(
            picker === "player" ? owner : showmanSocket,
            question.id,
            playerSockets
          );
          expect((await questionData).questionEligiblePlayers).toEqual([ownerId]);

          const rejected = scenario.waitForEvent<{ message: string }>(other, SocketIOEvents.ERROR);
          scenario.actor(other).emit(SocketIOGameEvents.QUESTION_ANSWER);
          expect((await rejected).message).toBe("It's not your turn");
          await utils.answerQuestion(owner, showmanSocket);

          const result = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
            other,
            SocketIOGameEvents.ANSWER_RESULT
          );
          const finished = scenario.waitForEvent(other, SocketIOGameEvents.QUESTION_FINISH);
          const reveal = scenario.waitForEvent(other, SocketIOGameEvents.ANSWER_SHOW_START);
          if (outcome === "give up") {
            scenario.actor(owner).emit(SocketIOGameEvents.QUESTION_SKIP, {});
          } else if (outcome === "wrong") {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
              scoreResult: -400,
              answerType: AnswerResultType.WRONG
            });
          } else {
            await suite.testUtils.expireTimerAndWaitForAction(
              gameId,
              GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED
            );
          }
          const [answer] = await Promise.all([result, finished, reveal]);
          expect(answer.answerResult).toMatchObject({
            player: ownerId,
            answerType: AnswerResultType.WRONG,
            result: 0,
            score: 0
          });
          const revealed = await utils.getGameState(gameId);
          expect(revealed).toMatchObject({
            questionState: QuestionState.SHOWING_ANSWER,
            currentQuestion: null,
            answeringPlayer: null
          });
          expect(revealed!.answerShowData?.answerText).toBe("No risk answer");
          expect(revealed!.timer).toBeTruthy();
          await utils.skipShowAnswer(showmanSocket);
          expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.CHOOSING);
        });
      }
    );

    it("should not decrease player score when answering NoRisk question incorrectly", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with 1 player
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const noRiskQuestion = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Get player's initial score (should be 0)
        const playerId = setup.playerUsers[0].id;
        await utils.setPlayerScore(gameId, playerId, 0);
        const initialScore = 0;

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          2000
        );

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as WRONG (negative score for NoRisk should not decrease score)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: -400, // Negative score (wrong answer)
          answerType: AnswerResultType.WRONG
        });

        // Wait for answer result to be processed
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Get the game state to check final player score
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // With NoRisk, score should not decrease even with wrong answer
        expect(finalScore).toBeGreaterThanOrEqual(initialScore);
      });
    });

    it("should allow player to gain score on correct NoRisk question answers", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with 1 player
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const noRiskQuestion = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Set initial score
        const playerId = setup.playerUsers[0].id;
        await utils.setPlayerScore(gameId, playerId, 0);
        const initialScore = 0;

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          2000
        );

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as CORRECT (positive score for NoRisk should work normally)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 800, // Positive score (correct answer, NoRisk has priceMultiplier: 2)
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result to be processed
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Get final score - NoRisk questions should still allow score gains
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // Should be able to gain points for correct answers
        expect(finalScore).toBe(initialScore + 800); // Should gain the full score for correct answer
      });
    });

    it("should handle skip answers for NoRisk questions appropriately", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with 1 player
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Find and pick a NoRisk question
        const noRiskQuestion = await utils.findQuestionByType(PackageQuestionType.NO_RISK, gameId);

        // Ensure NoRisk question exists (should always be available in test package)
        expect(noRiskQuestion).toBeDefined();
        expect(noRiskQuestion!.id).toBeGreaterThan(0);

        // Set initial score
        const playerId = setup.playerUsers[0].id;
        const initialScore = 0;
        await utils.setPlayerScore(gameId, playerId, initialScore);

        // Pick the NoRisk question and have player answer it
        await utils.pickQuestion(showmanSocket, noRiskQuestion!.id, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START,
          2000
        );

        // Set up event listener for answer result before showman reviews
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          2000
        );

        // Showman reviews the answer as SKIP (score should remain unchanged)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 0, // Zero score (skip)
          answerType: AnswerResultType.SKIP
        });

        // Wait for answer result to be processed
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify score remains unchanged after skip
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        const finalScore = player?.score || 0;

        // Skip should not affect score regardless of question type
        expect(finalScore).toBe(initialScore);
      });
    });
  });
});
