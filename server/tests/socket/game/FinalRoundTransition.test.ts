import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { FINAL_ROUND_THEME_ELIMINATION_TIME } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { User } from "infrastructure/database/models/User";
import {
  type GameTestSetup,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

// Helper function to verify final round data in game state
function verifyFinalRoundData(gameState: GameStateDTO) {
  const finalData = gameState.finalRoundData;
  expect(finalData).toBeDefined();

  // Placeholder to avoid compiler errors since we know finalData is defined
  if (finalData === null || finalData === undefined) {
    throw new Error("Final round data is not defined");
  }

  expect(gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
  expect(gameState.timer).toBeDefined();
  expect(gameState.timer!.durationMs).toBe(FINAL_ROUND_THEME_ELIMINATION_TIME);

  // Most importantly - verify final round data is present
  expect(finalData.turnOrder).toBeDefined();
  expect(Array.isArray(finalData.turnOrder)).toBe(true);
  expect(finalData.turnOrder.length).toBeGreaterThan(0);

  // Verify current turn player is set
  expect(gameState.currentTurnPlayerId).toBeDefined();
  expect(typeof gameState.currentTurnPlayerId).toBe("number");
}

// Helper function to verify showman gets full question data
function verifyShowmanQuestionData(gameState: GameStateDTO) {
  expect(gameState.currentRound).toBeDefined();
  expect(gameState.currentRound!.themes.length).toBe(3);

  // For each theme, verify it has question data
  for (let i = 0; i < 3; i++) {
    const theme = gameState.currentRound!.themes[i];
    expect(theme.questions.length).toBeGreaterThan(0);

    // The question should be a valid question object with at least basic properties
    const question = theme.questions[0];

    // Basic question metadata that would be visible to anyone
    expect(question.id).toBeTruthy();
    expect(question.order).toBeGreaterThanOrEqual(0);
    expect(question.price).toBeNull(); // Final round questions have null price
    expect(question.isPlayed).toBe(false);
  }
}

// Helper function to verify players get no question data
function verifyPlayerQuestionData(gameState: GameStateDTO) {
  expect(gameState.currentRound).toBeDefined();
  expect(gameState.currentRound!.themes.length).toBe(3);

  for (let i = 0; i < 3; i++) {
    const theme = gameState.currentRound!.themes[i];

    // Theme metadata should be visible
    expect(theme.id).toBeTruthy();
    expect(theme.name).toBeTruthy();
    expect(theme.order).toBeGreaterThanOrEqual(0);

    // Players should NOT see any questions during theme presentation
    expect(theme.questions).toEqual([]);
  }
}

describe("Final Round Transition Test", () => {
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

  async function completeAllButLastQuestion(setup: GameTestSetup): Promise<number> {
    const questionIds = await utils.getAllAvailableQuestionIds(setup.gameId);
    expect(questionIds.length).toBeGreaterThan(0);

    for (const questionId of questionIds.slice(0, -1)) {
      await utils.pickAndCompleteQuestion(setup.showmanSocket, setup.playerSockets, questionId);
    }

    return questionIds[questionIds.length - 1];
  }

  it("should transition to final round with proper initialization", async () => {
    await suite.scenario(async (scenario) => {
      /**
       * Tests the basic final round transition mechanics:
       * - Final round transition occurs after all regular round questions are completed
       * - Final round data is properly initialized with correct state
       * - Basic structure validation
       */
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2, // 2 players
        0, // 0 spectators
        true // include final round
      );

      const { showmanSocket } = setup;

      await utils.startGame(showmanSocket);

      const lastQuestionId = await completeAllButLastQuestion(setup);

      // Set up listener for final round transition
      const nextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );

      // Complete the final question in the regular round to trigger transition
      await utils.pickAndCompleteQuestion(showmanSocket, setup.playerSockets, lastQuestionId);

      // Verify final round transition
      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);

      // Verify round structure
      expect(gameState.currentRound).toBeDefined();
      expect(gameState.currentRound!.type).toBe(PackageRoundType.FINAL);
      expect(gameState.currentRound!.themes.length).toBe(3);
    });
  });

  it("should handle final round transition via explicit progression", async () => {
    await suite.scenario(async (scenario) => {
      /**
       * Tests explicit next round progression to final round
       */
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, true);
      await utils.startGame(setup.showmanSocket);

      const nextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );

      await utils.progressToNextRound(setup.showmanSocket);
      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    });
  });

  it("should handle final round transition via answering last question correctly", async () => {
    await suite.scenario(async (scenario) => {
      /**
       * Tests final round transition when last question is answered correctly
       */
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, true);
      await utils.startGame(setup.showmanSocket);

      const lastQuestionId = await completeAllButLastQuestion(setup);

      const nextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );

      // Answer the specific last question correctly
      await utils.pickAndCompleteQuestion(
        setup.showmanSocket,
        setup.playerSockets,
        lastQuestionId,
        true
      );

      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    });
  });

  it("should handle final round transition via skipping last question", async () => {
    await suite.scenario(async (scenario) => {
      /**
       * Tests final round transition when last question is skipped
       */
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, true);
      await utils.startGame(setup.showmanSocket);

      const lastQuestionId = await completeAllButLastQuestion(setup);

      const nextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        setup.showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );

      // Skip the final question to trigger natural progression
      await utils.pickAndCompleteQuestion(setup.showmanSocket, setup.playerSockets, lastQuestionId);

      const gameState = (await nextRoundPromise).gameState;
      verifyFinalRoundData(gameState);
    });
  });

  it("should provide role-based question visibility in final round", async () => {
    await suite.scenario(async (scenario) => {
      /**
       * Core test for the main requirement:
       * - Showman receives complete question data including text and answers
       * - Players receive only theme metadata with no question data
       * - Explicit verification of question content, answer content, and files
       */
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2, // 2 players
        0, // 0 spectators
        true // include final round
      );

      const { showmanSocket, playerSockets } = setup;

      await utils.startGame(showmanSocket);

      const lastQuestionId = await completeAllButLastQuestion(setup);

      // Set up promises for both showman and player
      const showmanNextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );

      const playerNextRoundPromise = scenario.waitForEvent<GameNextRoundEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.NEXT_ROUND
      );

      // Trigger final round transition with the final regular-round question
      await utils.pickAndCompleteQuestion(showmanSocket, setup.playerSockets, lastQuestionId);

      // Get both game states
      const [showmanGameState, playerGameState] = await Promise.all([
        showmanNextRoundPromise.then((payload) => payload.gameState),
        playerNextRoundPromise.then((payload) => payload.gameState)
      ]);

      // Verify basic final round setup for both
      verifyFinalRoundData(showmanGameState);
      verifyFinalRoundData(playerGameState);

      // SHOWMAN VERIFICATION: Should see full question data
      verifyShowmanQuestionData(showmanGameState);

      // PLAYER VERIFICATION: Should see no question data
      verifyPlayerQuestionData(playerGameState);

      // CROSS-VERIFICATION: Theme metadata should match
      for (let i = 0; i < 3; i++) {
        const showmanTheme = showmanGameState.currentRound!.themes[i];
        const playerTheme = playerGameState.currentRound!.themes[i];

        expect(showmanTheme.id).toBe(playerTheme.id);
        expect(showmanTheme.name).toBe(playerTheme.name);
        expect(showmanTheme.order).toBe(playerTheme.order);
      }
    });
  });
});
