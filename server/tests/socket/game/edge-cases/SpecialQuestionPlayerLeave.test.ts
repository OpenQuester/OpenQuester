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

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Special Question Type Player Leave Edge Cases", () => {
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
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Secret Question - Answering Player Leaves", () => {
    it("should auto-complete secret question with 0 points when answering player leaves and lead to next state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Find and pick a secret question
        const secretQuestion = await utils.findQuestionByType(
          PackageQuestionType.SECRET,
          gameId
        );
        expect(secretQuestion).toBeDefined();

        const secretPickedPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.SECRET_QUESTION_PICKED
        );

        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: secretQuestion!.id,
        });
        await secretPickedPromise;

        // Showman transfers secret question to player 0
        const showmanTransferPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.SECRET_QUESTION_TRANSFER
        );

        showmanSocket.emit(SocketIOGameEvents.SECRET_QUESTION_TRANSFER, {
          targetPlayerId: setup.playerUsers[0].id,
        });
        await showmanTransferPromise;

        // Now player 0 has the question and can start answering
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        await questionDataPromise;

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBe(setup.playerUsers[0].id);

        // Wait for auto-answer result
        const answerResultPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Answering player leaves
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);

        // Should get answer result with 0 points
        const answerResultData = await answerResultPromise;
        expect(answerResultData.answerResult.player).toBe(
          setup.playerUsers[0].id
        );
        expect(answerResultData.answerResult.result).toBe(0);

        // Verify secretQuestionData is cleared and state moved to CHOOSING
        // For secret questions, only one player can answer - if they leave, skip showing and go to choosing
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.secretQuestionData).toBeNull();
        expect(finalState!.answeringPlayer).toBeNull();
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Stake Question - Answering Player Leaves", () => {
    it("should auto-complete stake question with 0 points when winner leaves before answering", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Set player scores - player 0 has lower score, player 1 has higher score
        await utils.setPlayerScore(gameId, setup.playerUsers[0].id, 300);
        await utils.setPlayerScore(gameId, setup.playerUsers[1].id, 400);

        // Set player 0 as current turn player so they can pick the question
        await utils.setCurrentTurnPlayer(
          showmanSocket,
          setup.playerUsers[0].id
        );

        // Find and pick a stake question
        const stakeQuestion = await utils.findQuestionByType(
          PackageQuestionType.STAKE,
          gameId
        );
        expect(stakeQuestion).toBeDefined();

        const stakePickedPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );

        // Player 0 picks the stake question (as current turn player)
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestion!.id,
        });
        await stakePickedPromise;

        // Both players bid - player 0 (picker) goes all-in, player 1 passes
        const stakeWinnerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER
        );

        // Player 0 (picker) cannot pass as first bidder, so goes all-in
        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        });
        await firstBidPromise;

        // Wait for question data with extended timeout
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        // Player 1 passes
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        const winnerData = await stakeWinnerPromise;
        expect(winnerData.winnerPlayerId).toBe(setup.playerUsers[0].id); // Player 0 won

        await questionDataPromise;

        // Player 0 (winner) starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBe(setup.playerUsers[0].id);

        // Wait for auto-answer result
        const answerResultPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Winner (player 0) leaves
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);

        // Should get answer result with 0 points
        const answerResultData = await answerResultPromise;
        expect(answerResultData.answerResult.player).toBe(
          setup.playerUsers[0].id
        );
        expect(answerResultData.answerResult.result).toBe(0);

        // Verify stakeQuestionData is cleared and state moved to CHOOSING
        // For stake questions, only the bid winner can answer - if they leave, skip showing and go to choosing
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.stakeQuestionData).toBeNull();
        expect(finalState!.answeringPlayer).toBeNull();
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Stake Question - Player Leaves During Bidding", () => {
    it("should auto-pass for leaving player during stake bidding and continue with remaining players", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Set player scores - all players have enough to bid (question price is 200)
        await utils.setPlayerScore(gameId, playerUsers[0].id, 500);
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Set player 0 as current turn player
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Find and pick a stake question
        const stakeQuestion = await utils.findQuestionByType(
          PackageQuestionType.STAKE,
          gameId
        );
        expect(stakeQuestion).toBeDefined();

        const stakePickedPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );

        // Player 0 picks the stake question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestion!.id,
        });
        await stakePickedPromise;

        // Player 0 (picker) is first - they must bid (can't pass as first)
        // Use NORMAL bid with amount >= question price (200)
        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 200, // Must be at least question price
        });
        await firstBidPromise;

        // Verify state before player leaves
        const stateBeforeLeave = await utils.getGameState(gameId);
        expect(stateBeforeLeave!.questionState).toBe(QuestionState.BIDDING);
        expect(stateBeforeLeave!.stakeQuestionData).toBeDefined();

        // Player 1 (next in line) leaves during their turn to bid
        // This should trigger auto-pass for player 1
        const autoBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT,
          3000
        );

        playerSockets[1].emit(SocketIOGameEvents.LEAVE);

        // Should receive auto-pass event for leaving player
        const autoBidData = await autoBidPromise;
        expect(autoBidData.playerId).toBe(playerUsers[1].id);
        expect(autoBidData.bidType).toBe(StakeBidType.PASS);

        // Verify game continues - player 2 should now be current bidder
        // Since player 2 is last and there's already a bid, they can pass or bid
        // Let's have player 2 pass to trigger winner determination
        const stakeWinnerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER,
          3000
        );

        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        const winnerData = await stakeWinnerPromise;
        // Player 0 should win since they were the only one who bid
        expect(winnerData.winnerPlayerId).toBe(playerUsers[0].id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
