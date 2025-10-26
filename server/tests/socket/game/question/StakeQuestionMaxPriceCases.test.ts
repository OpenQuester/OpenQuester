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
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import {
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import {
  GameTestSetup,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Stake Question Max Price Cases Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  /**
   * Flexible preparation function for stake question tests
   * Handles common setup tasks with configurable parameters
   */
  async function _prepare(
    options: {
      playerCount?: number;
      showmanIndex?: number;
      playerScores?: number[];
      shouldPickQuestion?: boolean;
      pickerIndex?: number;
    } = {}
  ): Promise<{
    setup: GameTestSetup;
    stakeQuestionId: number;
    cleanup: () => Promise<void>;
  }> {
    const {
      playerCount = 3,
      showmanIndex = 0,
      playerScores = [500, 600, 400], // Default scores that work well with default maxPrice 400
      shouldPickQuestion = true,
      pickerIndex = 0,
    } = options;

    const setup = await utils.setupGameTestEnvironment(
      userRepo,
      app,
      playerCount,
      showmanIndex
    );
    const { showmanSocket, gameId, playerUsers } = setup;

    await utils.startGame(showmanSocket);

    // Set player scores
    for (let i = 0; i < playerCount; i++) {
      const score = playerScores[i] || 500; // Default fallback
      await utils.setPlayerScore(gameId, playerUsers[i].id, score);
    }

    // Set current turn player to the picker
    await utils.setCurrentTurnPlayer(
      showmanSocket,
      playerUsers[pickerIndex].id
    );

    // Get STAKE question ID
    const stakeQuestionId = await utils.getQuestionIdByType(
      gameId,
      PackageQuestionType.STAKE
    );

    if (shouldPickQuestion) {
      // Pick the stake question
      setup.playerSockets[pickerIndex].emit(SocketIOGameEvents.QUESTION_PICK, {
        questionId: stakeQuestionId,
      });

      // Wait for stake question to be picked
      await utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.STAKE_QUESTION_PICKED
      );
    }

    return {
      setup,
      stakeQuestionId,
      cleanup: () => utils.cleanupGameClients(setup),
    };
  }

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
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
  });

  describe("Max Price Related Behaviors", () => {
    it("should automatically bid question price when picker has insufficient score", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Set up player scores where auto-bid should win immediately:
        // - Player 0 (picker): 50 score (will auto-bid 200 - the question price)
        // - Player 1: 40 score (cannot outbid 200)
        // - Player 2: 30 score (cannot outbid 200)
        await utils.setPlayerScore(gameId, playerUsers[0].id, 50);
        await utils.setPlayerScore(gameId, playerUsers[1].id, 40);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 30);

        // Explicitly set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID (price 200, maxPrice 400)
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Listen for both stake question picked and automatic bid
        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        const autoBidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT,
          150
        );

        // Player 0 (score 50) picks STAKE question (price 200)
        // Should automatically place bid of 200 (question price)
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        // Verify stake question picked event
        const stakeData = await stakePickedPromise;
        expect(stakeData.pickerPlayerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(stakeData.maxPrice).toBe(400);

        // Verify automatic bid submission
        const bidResult = await autoBidPromise;
        expect(bidResult.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(bidResult.bidAmount).toBe(200); // Player auto-bids question price, not their available score
        expect(bidResult.bidType).toBe(StakeBidType.NORMAL);
        expect(bidResult.nextBidderId).toBe(null); // Auto-bid ends bidding since other players can't outbid

        // Verify that player bids the question price when insufficient score
        const gameState = await utils.getGameState(gameId);
        const player0Id = await utils.getUserIdFromSocket(playerSockets[0]);
        expect(gameState?.stakeQuestionData?.bids).toHaveProperty(
          player0Id.toString(),
          200
        ); // Player has bid 200 (question price), not 50 (their available score)
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow all-in bids", async () => {
      // Setup with player score exactly equal to maxPrice to avoid validation issues
      const { setup, cleanup } = await _prepare({
        playerScores: [400, 600, 300], // Player 0 score = maxPrice (400)
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        const bidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 goes all-in (should bid their full score of 400, which equals maxPrice)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        const result = await bidPromise;
        expect(result.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(result.bidAmount).toBe(400); // Player score = maxPrice = 400
        expect(result.bidType).toBe(StakeBidType.ALL_IN);
      } finally {
        await cleanup();
      }
    });

    it("should not count max score bid as all-in", async () => {
      // Setup with player score higher than maxPrice to test normal bid logic
      const { setup, cleanup } = await _prepare({
        playerScores: [500, 600, 400], // Player 0 score > maxPrice (400)
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        const bidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 bids the max price (400) - should NOT be detected as all-in
        // since player has more score (500) than the bid amount
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 400, // Question max price - should be treated as normal bid
        } as StakeBidSubmitInputData);

        const result = await bidPromise;
        expect(result.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(result.bidAmount).toBe(400); // Question max price
        expect(result.bidType).toBe(StakeBidType.NORMAL); // Should be NORMAL, not ALL_IN
      } finally {
        await cleanup();
      }
    });

    it("should reject bid exceeding question max price", async () => {
      // Setup with custom scores to test this scenario
      const { setup, cleanup } = await _prepare({
        playerScores: [500, 700, 500], // High scores to avoid automatic bidding
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // First, player[0] bids to start the sequence (must be >= question price of 200)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Listen for error on Player 1's socket (the one making the invalid bid)
        const errorPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOEvents.ERROR
        );

        // Player[1] (score 700) tries to bid more than question max price (400)
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 500, // exceeds question max price of 400
        });

        const error = await errorPromise;
        expect(error.message).toMatch(/maximum.*price|exceeds/i);
      } finally {
        await cleanup();
      }
    });

    it("should support continuous bidding until all-in", async () => {
      // Setup with appropriate scores for continuous bidding
      const { setup, cleanup } = await _prepare({
        playerScores: [400, 450, 350], // Scores that allow for continuous bidding up to maxPrice
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Round 1: p0 bids 250, p1 bids 260, p2 bids 270 (all >= question price of 200)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 260,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 270,
        });
        let bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Should continue to player[0] for next round of continuous bidding
        expect(bidResult.isPhaseComplete).toBe(false);
        expect(bidResult.nextBidderId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );

        // Round 2: p0 bids 280, p1 bids 290, p2 bids 300
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 280,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 290,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 300,
        });
        bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Round 3: p0 goes all-in (400 - their score, which equals question max price)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        });
        bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        expect(bidResult.bidType).toBe(StakeBidType.ALL_IN);
        expect(bidResult.bidAmount).toBe(400); // Player's score = Question max price
      } finally {
        await cleanup();
      }
    });

    it("should automatically declare winner when player bids maximum price", async () => {
      // Setup with proper scores for manual bidding
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        // Set player scores to make player[0] the current turn player with sufficient score for manual bidding
        await utils.setPlayerScore(gameId, playerUsers[0].id, 500); // Sufficient score for manual bidding (> maxPrice 400)
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Explicitly set current turn player to player[0] (score changes don't auto-update turn player)
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Player 0 (current turn player) starts stake question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );

        const winnerPromise = utils.waitForEvent<StakeQuestionWinnerEventData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER
        );

        // Player 0 bids the maximum price (400) - should automatically end bidding and declare winner
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 400,
        });

        // Should get both the bid result AND the winner announcement
        const bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        expect(bidResult.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(bidResult.bidAmount).toBe(400);
        expect(bidResult.bidType).toBe(StakeBidType.NORMAL); // Max price bid is NORMAL since player score (500) > bid amount (400)
        expect(bidResult.isPhaseComplete).toBe(true); // Bidding should be complete
        expect(bidResult.nextBidderId).toBe(null); // No next bidder since phase is complete

        // Winner should be announced immediately
        const winnerData = await winnerPromise;
        expect(winnerData.winnerPlayerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(winnerData.finalBid).toBe(400);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should automatically end bidding when auto-bid wins", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Set player scores:
        // Player 1 (picker) = 50 (less than question price 200, will auto-bid 200)
        // Player 2 = 40 (cannot outbid auto-bid of 200)
        // Player 3 = 30 (cannot outbid auto-bid of 200)
        await utils.setPlayerScore(gameId, playerUsers[0].id, 50);
        await utils.setPlayerScore(gameId, playerUsers[1].id, 40);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 30);

        // Set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID (price 200, maxPrice 400)
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Listen for both stake question picked and automatic bid AND winner announcement
        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        const autoBidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT,
          150
        );

        const winnerPromise = utils.waitForEvent<StakeQuestionWinnerEventData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER,
          200
        );

        // Player 0 (score 50) picks STAKE question (price 200)
        // Should automatically bid question price (200) and win immediately
        // since other players (40, 30) cannot outbid 200
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        // Verify stake question picked event
        const stakeData = await stakePickedPromise;
        expect(stakeData.pickerPlayerId).toBe(playerUsers[0].id);
        expect(stakeData.maxPrice).toBe(400);

        // Verify automatic bid submission
        const bidResult = await autoBidPromise;
        expect(bidResult.playerId).toBe(playerUsers[0].id);
        expect(bidResult.bidAmount).toBe(200); // Player auto-bids question price, not their available score
        expect(bidResult.bidType).toBe(StakeBidType.NORMAL);
        expect(bidResult.isPhaseComplete).toBe(true); // Should complete immediately since no one can outbid
        expect(bidResult.nextBidderId).toBe(null); // No next bidder

        // Verify winner announcement
        const winnerData = await winnerPromise;
        expect(winnerData.winnerPlayerId).toBe(playerUsers[0].id);
        expect(winnerData.finalBid).toBe(200); // Player auto-bids question price, not their available score
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should restrict numeric bids after ALL_IN bid", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 4, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start the game
        await utils.startGame(showmanSocket);

        // Set player scores for a valid bidding scenario:
        // Player 1 (picker) = 300, Player 2 = 250, Player 3 = 350, Player 4 = 380
        // Player 1 bids 200, Player 2 goes ALL_IN (250), Player 3 tries numeric bid (should fail)
        await utils.setPlayerScore(gameId, playerUsers[0].id, 300); // Player 1 (picker)
        await utils.setPlayerScore(gameId, playerUsers[1].id, 250); // Player 2 (will go ALL_IN)
        await utils.setPlayerScore(gameId, playerUsers[2].id, 350); // Player 3 (tries numeric bid)
        await utils.setPlayerScore(gameId, playerUsers[3].id, 380); // Player 4 (can go ALL_IN if needed)

        // Set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Player 1 picks the stake question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        // Wait for stake question to be picked
        await utils.waitForEvent<StakeQuestionPickedBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );

        // Player 1 (picker) bids first - normal bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 200,
        });

        // Wait for Player 1's bid to be processed
        const firstBidResult =
          await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

        expect(firstBidResult.playerId).toBe(playerUsers[0].id);
        expect(firstBidResult.bidAmount).toBe(200);
        expect(firstBidResult.bidType).toBe(StakeBidType.NORMAL);
        expect(firstBidResult.nextBidderId).toBe(playerUsers[1].id); // Player 2's turn

        // Player 2 goes ALL_IN (250)
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        });

        // Wait for Player 2's ALL_IN bid to be processed
        const allInResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        expect(allInResult.playerId).toBe(playerUsers[1].id);
        expect(allInResult.bidAmount).toBe(250); // Player 2's full score (ALL_IN)
        expect(allInResult.bidType).toBe(StakeBidType.ALL_IN);
        expect(allInResult.isPhaseComplete).toBe(false); // Should continue bidding
        expect(allInResult.nextBidderId).toBe(playerUsers[2].id); // Player 3's turn

        // Player 3 tries to make a numeric bid (should be rejected)
        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 300,
        });

        // Should get an error response since numeric bids are not allowed after ALL_IN
        const errorResult = await utils.waitForEvent<any>(
          playerSockets[2],
          SocketIOEvents.ERROR
        );

        expect(errorResult).toBeDefined();
        expect(errorResult.message).toContain(
          "After an all-in bid has been made, only all-in or pass bids are allowed"
        );

        // Player 3 should be able to PASS
        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        const passResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        expect(passResult.playerId).toBe(playerUsers[2].id);
        expect(passResult.bidType).toBe(StakeBidType.PASS);
        expect(passResult.nextBidderId).toBe(playerUsers[3].id); // Player 4's turn

        // Player 4 can go ALL_IN if they want to compete
        playerSockets[3].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        });

        const secondAllInResult =
          await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

        expect(secondAllInResult.playerId).toBe(playerUsers[3].id);
        expect(secondAllInResult.bidAmount).toBe(380); // Player 4's full score
        expect(secondAllInResult.bidType).toBe(StakeBidType.ALL_IN);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle player with exact score-to-max-price ratio", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Set player scores where player[0] has exactly 400 (question max price)
        // This tests the edge case where player score = question max price
        await utils.setPlayerScore(gameId, playerUsers[0].id, 400); // Exactly equal to question max price
        await utils.setPlayerScore(gameId, playerUsers[1].id, 500);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 600);

        // Set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID (price 200, maxPrice 400)
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        // Player 0 (score 400) picks STAKE question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        await stakePickedPromise;

        // Player 0 should be able to manually bid since score (400) >= question price (200)
        // But when they bid their max (400), it's considered ALL_IN since it equals their total score
        const bidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 bids exactly their score (400) - should be accepted as ALL_IN
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 400,
        });

        const bidResult = await bidPromise;
        expect(bidResult.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(bidResult.bidAmount).toBe(400);
        expect(bidResult.bidType).toBe(StakeBidType.ALL_IN); // When bid = player score, it's ALL_IN

        // Since this equals the max price, bidding should end immediately
        expect(bidResult.isPhaseComplete).toBe(true);
        expect(bidResult.nextBidderId).toBe(null);

        // Test that the constraint exists: player with score X can bid at most X
        const gameState = await utils.getGameState(gameId);
        const player0Id = await utils.getUserIdFromSocket(playerSockets[0]);
        expect(gameState?.stakeQuestionData?.bids).toHaveProperty(
          player0Id.toString(),
          400
        );

        // Verify player could only bid their exact score (400) when going all-in
        // This demonstrates: player score = max bid amount when going all-in
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle player with score equal to question price as all-in", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Set player scores where player[0] has exactly 200 (question price, not maxPrice)
        // This tests the edge case where player score = question base price
        await utils.setPlayerScore(gameId, playerUsers[0].id, 200); // Exactly equal to question price
        await utils.setPlayerScore(gameId, playerUsers[1].id, 300);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID (price 200, maxPrice 400)
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        // Player 0 (score 200) picks STAKE question (price 200, maxPrice 400)
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        await stakePickedPromise;

        // Player 0 should be able to manually bid since score (200) >= question price (200)
        // When they bid exactly their score (200), it should be classified as ALL_IN
        const bidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 bids exactly their score (200) which equals the question price
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 200,
        });

        const bidResult = await bidPromise;
        expect(bidResult.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(bidResult.bidAmount).toBe(200);
        expect(bidResult.bidType).toBe(StakeBidType.ALL_IN); // When bid = player score, it's ALL_IN

        // Bidding should continue since this doesn't equal max price (400)
        expect(bidResult.isPhaseComplete).toBe(false);
        expect(bidResult.nextBidderId).toBe(
          await utils.getUserIdFromSocket(playerSockets[1])
        );

        // Verify the bid was recorded correctly
        const gameState = await utils.getGameState(gameId);
        const player0Id = await utils.getUserIdFromSocket(playerSockets[0]);
        expect(gameState?.stakeQuestionData?.bids).toHaveProperty(
          player0Id.toString(),
          200
        );

        // This demonstrates: when player score equals question price,
        // they can bid that amount as ALL_IN, even though it's also the minimum bid
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
