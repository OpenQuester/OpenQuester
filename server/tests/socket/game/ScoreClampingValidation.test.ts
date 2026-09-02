import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { MAX_SCORE_DELTA, SCORE_ABS_LIMIT } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { GameTestSetup, SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Score Clamping Validation Tests", () => {
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

  /**
   * Helper function to setup basic game environment for score testing
   */
  async function setupScoreTestEnvironment(): Promise<GameTestSetup> {
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
    const { showmanSocket, gameId, playerUsers } = setup;

    // Start the game
    await utils.startGame(showmanSocket);

    // Set initial player scores
    await utils.setPlayerScore(gameId, playerUsers[0].id, 1000000); // 1M initial score
    await utils.setPlayerScore(gameId, playerUsers[1].id, 500000); // 500K initial score

    return setup;
  }

  describe("Answer Review Score Delta Clamping", () => {
    it("should clamp positive answer review score when exceeding MAX_SCORE_DELTA", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { playerSockets, showmanSocket, gameId } = setup;
        const playerId = setup.playerUsers[0].id;

        // Get initial player score
        const initialGame = await utils.getGameFromGameService(gameId);
        const initialPlayer = initialGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const initialScore = initialPlayer?.score || 0;

        // Pick a simple question and have player answer it
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Set up event listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          5000
        );

        // Showman reviews with score exceeding MAX_SCORE_DELTA by 50,000
        const excessiveScore = MAX_SCORE_DELTA + 50_000; // 2,050,000
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: excessiveScore,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result to be processed
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Get final player score and verify clamping
        const finalGame = await utils.getGameFromGameService(gameId);
        const finalPlayer = finalGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const finalScore = finalPlayer?.score || 0;

        // Score change should be clamped to MAX_SCORE_DELTA, not the excessive amount
        const expectedScore = initialScore + MAX_SCORE_DELTA;
        expect(finalScore).toBe(expectedScore);
        expect(finalScore).not.toBe(initialScore + excessiveScore);
      });
    });

    it("should clamp negative answer review score when exceeding MAX_SCORE_DELTA", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { playerSockets, showmanSocket, gameId } = setup;
        const playerId = setup.playerUsers[0].id;

        // Get initial player score
        const initialGame = await utils.getGameFromGameService(gameId);
        const initialPlayer = initialGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const initialScore = initialPlayer?.score || 0;

        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up event listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          5000
        );

        // Showman reviews with negative score exceeding MAX_SCORE_DELTA by 50,000
        const excessiveNegativeScore = -(MAX_SCORE_DELTA + 50_000); // -2,050,000
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: excessiveNegativeScore,
          answerType: AnswerResultType.WRONG
        });

        // Wait for answer result to be processed
        await answerResultPromise;

        // Verify score immediately after answer (before question finishes)
        const afterAnswerGame = await utils.getGameFromGameService(gameId);
        const afterAnswerPlayer = afterAnswerGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const afterAnswerScore = afterAnswerPlayer?.score || 0;

        // Score change should be clamped to -MAX_SCORE_DELTA, not the excessive negative amount
        const expectedScore = initialScore - MAX_SCORE_DELTA;
        expect(afterAnswerScore).toBe(expectedScore);
        expect(afterAnswerScore).not.toBe(initialScore + excessiveNegativeScore);

        // Complete the question flow (with 2 players, another player can still answer)
        // Force skip to finish the question
        await utils.skipQuestion(showmanSocket);
        await utils.skipShowAnswer(showmanSocket);

        // Get final player score and verify clamping persisted
        const finalGame = await utils.getGameFromGameService(gameId);
        const finalPlayer = finalGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const finalScore = finalPlayer?.score || 0;

        expect(finalScore).toBe(expectedScore);
      });
    });

    it("should allow normal score changes within MAX_SCORE_DELTA bounds", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { playerSockets, showmanSocket, gameId } = setup;
        const playerId = setup.playerUsers[0].id;

        // Get initial player score
        const initialGame = await utils.getGameFromGameService(gameId);
        const initialPlayer = initialGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const initialScore = initialPlayer?.score || 0;

        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Set up event listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          5000
        );

        // Showman reviews with score within MAX_SCORE_DELTA bounds
        const normalScore = 500_000; // Well within the 2M limit
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: normalScore,
          answerType: AnswerResultType.CORRECT
        });

        // Wait for answer result to be processed
        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Get final player score and verify it's applied normally
        const finalGame = await utils.getGameFromGameService(gameId);
        const finalPlayer = finalGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const finalScore = finalPlayer?.score || 0;

        // Score should be applied normally without clamping
        const expectedScore = initialScore + normalScore;
        expect(finalScore).toBe(expectedScore);
      });
    });
  });

  describe("Player Score Change Event Clamping", () => {
    it("should clamp positive player score change when exceeding SCORE_ABS_LIMIT", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { showmanSocket } = setup;
        const playerId = setup.playerUsers[0].id;

        // Set up event listener for score change
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        // Showman tries to set score exceeding SCORE_ABS_LIMIT
        const excessiveScore = SCORE_ABS_LIMIT + 50_000; // 2,100,050,000
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: excessiveScore
        });

        // Wait for score change to be processed
        const scoreChangeResult = await scoreChangePromise;

        // Verify the applied score is clamped to SCORE_ABS_LIMIT
        expect(scoreChangeResult.newScore).toBe(SCORE_ABS_LIMIT);
        expect(scoreChangeResult.newScore).not.toBe(excessiveScore);
        expect(scoreChangeResult.playerId).toBe(playerId);

        // Double-check by getting the game state
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        expect(player?.score).toBe(SCORE_ABS_LIMIT);
      });
    });

    it("should clamp negative player score change when exceeding SCORE_ABS_LIMIT", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { showmanSocket } = setup;
        const playerId = setup.playerUsers[0].id;

        // Set up event listener for score change
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        // Showman tries to set negative score exceeding SCORE_ABS_LIMIT
        const excessiveNegativeScore = -(SCORE_ABS_LIMIT + 50_000); // -2,100,050,000
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: excessiveNegativeScore
        });

        // Wait for score change to be processed
        const scoreChangeResult = await scoreChangePromise;

        // Verify the applied score is clamped to -SCORE_ABS_LIMIT
        expect(scoreChangeResult.newScore).toBe(-SCORE_ABS_LIMIT);
        expect(scoreChangeResult.newScore).not.toBe(excessiveNegativeScore);
        expect(scoreChangeResult.playerId).toBe(playerId);

        // Double-check by getting the game state
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        expect(player?.score).toBe(-SCORE_ABS_LIMIT);
      });
    });

    it("should allow normal score changes within SCORE_ABS_LIMIT bounds", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { showmanSocket } = setup;
        const playerId = setup.playerUsers[0].id;

        // Set up event listener for score change
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        // Showman sets score within SCORE_ABS_LIMIT bounds
        const normalScore = 1_500_000_000; // Well within the 2.1B limit
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: normalScore
        });

        // Wait for score change to be processed
        const scoreChangeResult = await scoreChangePromise;

        // Verify the score is applied normally without clamping
        expect(scoreChangeResult.newScore).toBe(normalScore);
        expect(scoreChangeResult.playerId).toBe(playerId);

        // Double-check by getting the game state
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        expect(player?.score).toBe(normalScore);
      });
    });

    it("should handle score change to exactly SCORE_ABS_LIMIT boundary", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { showmanSocket } = setup;
        const playerId = setup.playerUsers[0].id;

        // Set up event listener for score change
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        // Showman sets score to exactly SCORE_ABS_LIMIT
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: SCORE_ABS_LIMIT // Exactly 2,100,000,000
        });

        // Wait for score change to be processed
        const scoreChangeResult = await scoreChangePromise;

        // Verify the score is applied exactly (boundary case)
        expect(scoreChangeResult.newScore).toBe(SCORE_ABS_LIMIT);
        expect(scoreChangeResult.playerId).toBe(playerId);

        // Double-check by getting the game state
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        expect(player?.score).toBe(SCORE_ABS_LIMIT);
      });
    });

    it("should handle score change to exactly negative SCORE_ABS_LIMIT boundary", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { showmanSocket } = setup;
        const playerId = setup.playerUsers[0].id;

        // Set up event listener for score change
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        // Showman sets score to exactly -SCORE_ABS_LIMIT
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: -SCORE_ABS_LIMIT // Exactly -2,100,000,000
        });

        // Wait for score change to be processed
        const scoreChangeResult = await scoreChangePromise;

        // Verify the score is applied exactly (boundary case)
        expect(scoreChangeResult.newScore).toBe(-SCORE_ABS_LIMIT);
        expect(scoreChangeResult.playerId).toBe(playerId);

        // Double-check by getting the game state
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.getPlayer(playerId, { fetchDisconnected: true });
        expect(player?.score).toBe(-SCORE_ABS_LIMIT);
      });
    });
  });

  describe("Score Clamping Integration Tests", () => {
    it("should apply both types of clamping in sequence correctly", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await setupScoreTestEnvironment();

        const { playerSockets, showmanSocket, gameId } = setup;
        const playerId = setup.playerUsers[0].id;

        // First, set player to a high score near the limit using score change event
        const scoreChangePromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SCORE_CHANGED,
          5000
        );

        const nearLimitScore = SCORE_ABS_LIMIT - 1_000_000; // 2,099,000,000
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.SCORE_CHANGED, {
          playerId: playerId,
          newScore: nearLimitScore
        });

        await scoreChangePromise;

        // Then, try to increase score through answer review beyond the limit
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const showAnswerStartPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT,
          5000
        );

        // Try to add more than the remaining headroom to the limit
        const attemptedIncrease = 2_000_000; // This would exceed SCORE_ABS_LIMIT
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: attemptedIncrease,
          answerType: AnswerResultType.CORRECT
        });

        await answerResultPromise;
        await showAnswerStartPromise;
        await utils.skipShowAnswer(showmanSocket);

        // Verify final score is clamped to SCORE_ABS_LIMIT
        const finalGame = await utils.getGameFromGameService(gameId);
        const finalPlayer = finalGame.getPlayer(playerId, {
          fetchDisconnected: true
        });
        const finalScore = finalPlayer?.score || 0;

        // Score should be clamped to SCORE_ABS_LIMIT, not nearLimitScore + attemptedIncrease
        expect(finalScore).toBe(SCORE_ABS_LIMIT);
        expect(finalScore).not.toBe(nearLimitScore + attemptedIncrease);
      });
    });
  });
});
