import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Auto-Skip Question Flow Tests", () => {
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

  describe("Secret Question Auto-Skip", () => {
    it("should skip secret question transfer phase when only showman is in game", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with only showman (0 players, 0 spectators)
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Find a secret question
        const secretQuestion = await utils.findQuestionByType(PackageQuestionType.SECRET, gameId);

        expect(secretQuestion).toBeDefined();
        expect(secretQuestion!.id).toBeGreaterThan(0);

        // Set up listener for question data (which should come immediately when auto-skipping)
        const questionDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA,
          5000
        );

        // Pick the secret question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id
        });

        const questionData = await questionDataPromise;

        // Verify we got the question data directly (skipped transfer phase)
        expect(questionData.data.id).toBe(secretQuestion!.id);
        expect(questionData.data.type).toBe(PackageQuestionType.SECRET);

        // Verify the game state shows SHOWING (not SECRET_TRANSFER)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
        expect(finalState!.secretQuestionData).toBeNull();
      });
    });
  });

  describe("Stake Question Auto-Skip", () => {
    it("should skip stake question bidding phase when only showman is in game", async () => {
      await suite.scenario(async (scenario) => {
        // Setup game with only showman (0 players, 0 spectators)
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        const { showmanSocket, gameId } = setup;

        // Start the game
        await utils.startGame(showmanSocket);

        // Find a stake question
        const stakeQuestion = await utils.findQuestionByType(PackageQuestionType.STAKE, gameId);

        expect(stakeQuestion).toBeDefined();
        expect(stakeQuestion!.id).toBeGreaterThan(0);

        // Set up listener for question data (which should come immediately when auto-skipping)
        const questionDataPromise = scenario.waitForEvent<GameQuestionDataEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA,
          5000
        );

        // Pick the stake question
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestion!.id
        });

        const questionData = await questionDataPromise;

        // Verify we got the question data directly (skipped bidding phase)
        expect(questionData.data.id).toBe(stakeQuestion!.id);
        expect(questionData.data.type).toBe(PackageQuestionType.STAKE);

        // Verify the game state shows SHOWING (not BIDDING)
        // Logic: No players - show as simple question in SHOWING state
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
      });
    });
  });
});
