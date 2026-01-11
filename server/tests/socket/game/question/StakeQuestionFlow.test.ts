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
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
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

describe("Stake Question Flow Tests", () => {
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

  describe("STAKE Question Selection", () => {
    it("should emit STAKE_QUESTION_PICKED when stake question is selected", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Set player scores to make player[0] the current turn player
        await utils.setPlayerScore(gameId, playerUsers[0].id, 100); // Lowest score - current turn player
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Explicitly set current turn player to player[0]
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        // Get STAKE question ID
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Listen for stake question picked event
        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        // Player 0 (current turn player) picks STAKE question
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        const stakeData = await stakePickedPromise;

        expect(stakeData).toBeDefined();
        expect(stakeData.pickerPlayerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(stakeData.questionId).toBe(stakeQuestionId);
        expect(stakeData.maxPrice).toBe(400); // From PackageUtils STAKE question
        expect(stakeData.biddingOrder).toHaveLength(3);
        expect(stakeData.biddingOrder[0]).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(stakeData.timer).toBeDefined();
        expect(stakeData.timer.durationMs).toBe(30000); // 30 seconds per bid

        // Verify game state is in bidding mode
        const gameState = await utils.getGameState(gameId);
        expect(gameState?.questionState).toBe(QuestionState.BIDDING);
        expect(gameState?.stakeQuestionData).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle showman picking STAKE question (random first bidder)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Start game
        await utils.startGame(showmanSocket);

        // Set player scores to make player[0] have lowest score if game logic determines current turn player
        await utils.setPlayerScore(gameId, playerUsers[0].id, 100);
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Get STAKE question ID
        const stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Listen for stake question picked event
        const stakePickedPromise =
          utils.waitForEvent<StakeQuestionPickedBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_QUESTION_PICKED
          );

        // Showman picks STAKE question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        const stakeData = await stakePickedPromise;

        expect(stakeData).toBeDefined();
        expect(stakeData.pickerPlayerId).toBe(
          await utils.getUserIdFromSocket(showmanSocket)
        );
        expect(stakeData.questionId).toBe(stakeQuestionId);
        expect(stakeData.maxPrice).toBe(400); // From PackageUtils STAKE question
        expect(stakeData.biddingOrder).toHaveLength(3);
        // When showman picks, first bidder should be one of the players (we can't test randomness)
        expect(stakeData.biddingOrder[0]).toBeDefined();
        expect([
          await utils.getUserIdFromSocket(playerSockets[0]),
          await utils.getUserIdFromSocket(playerSockets[1]),
          await utils.getUserIdFromSocket(playerSockets[2]),
        ]).toContain(stakeData.biddingOrder[0]);
        expect(stakeData.timer).toBeDefined();
        expect(stakeData.timer.durationMs).toBe(30000); // 30 seconds per bid

        // Verify game state is in bidding mode
        const gameState = await utils.getGameState(gameId);
        expect(gameState?.questionState).toBe(QuestionState.BIDDING);
        expect(gameState?.stakeQuestionData).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    describe("Sequential Bidding Process", () => {
      let setup: GameTestSetup;
      let stakeQuestionId: number;

      beforeEach(async () => {
        setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, gameId, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        // Set player scores to make player[0] the current turn player with sufficient score for manual bidding
        await utils.setPlayerScore(gameId, playerUsers[0].id, 500); // Sufficient score for manual bidding (> maxPrice 400)
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Explicitly set current turn player to player[0] (score changes don't auto-update turn player)
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Player 0 (current turn player) starts stake question
        setup.playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        // Wait for stake question to be picked
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );
      });

      afterEach(async () => {
        await utils.cleanupGameClients(setup);
      });

      it("should allow valid numerical bids from current bidder", async () => {
        const { playerSockets, showmanSocket } = setup;

        const bidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 (picker/first bidder) bids 250 (must be >= question price of 200)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        } as StakeBidSubmitInputData);

        const result = await bidPromise;
        expect(result.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(result.bidAmount).toBe(250);
        expect(result.bidType).toBe(StakeBidType.NORMAL);
        expect(result.isPhaseComplete).toBe(false);
        expect(result.nextBidderId).toBe(
          await utils.getUserIdFromSocket(playerSockets[1])
        );
        expect(result.timer).toBeDefined();
        expect(result.timer?.durationMs).toBe(30000); // 30 seconds for next bid
      });

      it("should allow pass bids after first bid", async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, gameId, playerUsers, playerSockets } = setup;

        await utils.startGame(showmanSocket);
        // Set player scores to make player[0] the current turn player with sufficient score for manual bidding
        await utils.setPlayerScore(gameId, playerUsers[0].id, 500); // Sufficient score for manual bidding (> maxPrice 400)
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Explicitly set current turn player to player[0] (score changes don't auto-update turn player)
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Player 0 (current turn player) starts stake question
        setup.playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        // Wait for stake question to be picked
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );

        // First, player 0 must place a bid (can't pass as first bidder)
        const firstBidPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        } as StakeBidSubmitInputData);

        await firstBidPromise;

        // Now player 1 can pass
        const passPromise = utils.waitForEvent<StakeBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        const result = await passPromise;
        expect(result.playerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[1])
        );
        expect(result.bidAmount).toBe(null);
        expect(result.bidType).toBe(StakeBidType.PASS);
        expect(result.nextBidderId).toBe(
          await utils.getUserIdFromSocket(playerSockets[2])
        );
      });

      it("should reject bid from non-current bidder", async () => {
        // Use default setup with proper scores
        const { setup, cleanup } = await _prepare({
          playerScores: [500, 600, 400],
          shouldPickQuestion: true,
          pickerIndex: 0,
        });

        try {
          const { playerSockets } = setup;

          // Listen for error on the socket making the invalid bid (Player 1)
          const errorPromise = utils.waitForEvent(
            playerSockets[1],
            SocketIOEvents.ERROR
          );

          // Player 1 tries to bid when it's Player 0's turn
          playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 250,
          });

          const error = await errorPromise;
          expect(error.message).toContain("turn");
        } finally {
          await cleanup();
        }
      });

      it("should reject bid lower than current highest", async () => {
        // Setup separate test with independent setup
        const { setup, cleanup } = await _prepare({
          playerScores: [500, 600, 400],
          shouldPickQuestion: true,
          pickerIndex: 0,
        });

        try {
          const { playerSockets, showmanSocket } = setup;

          // Player 0 bids 250 (must be >= question price of 200)
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

          // Player 1 tries to bid lower
          playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 50,
          });

          const error = await errorPromise;
          expect(error.message).toMatch(/bid|low/i);
        } finally {
          await cleanup();
        }
      });

      it("should reject bid exceeding player score", async () => {
        // Setup with specific scores to test this scenario
        const { setup, cleanup } = await _prepare({
          playerScores: [500, 350, 280], // Higher score for picker to avoid automatic bid
          shouldPickQuestion: true,
          pickerIndex: 0,
        });

        try {
          const { playerSockets, showmanSocket } = setup;

          // First bid something to get to Player 2's turn (score: 250)
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
          // Listen for error on Player 2's socket (the one making the invalid bid)
          const errorPromise = utils.waitForEvent(
            playerSockets[2],
            SocketIOEvents.ERROR
          );

          // Player 2 (score: 250) tries to bid more than they have
          playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 300, // Exceeds their score of 280
          });

          const error = await errorPromise;
          expect(error.message).toMatch(/score|insufficient/i);
        } finally {
          await cleanup();
        }
      });

      it("should reject bid when player score is lower than current highest bid", async () => {
        // Setup with specific scores for this validation test
        const { setup, cleanup } = await _prepare({
          playerScores: [400, 450, 350], // Player 2 has lowest score (350)
          shouldPickQuestion: true,
          pickerIndex: 0,
        });

        try {
          const { playerSockets, showmanSocket } = setup;

          // Player[0] bids 350
          playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 350,
          });
          let bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.NORMAL);
          expect(bidResult.bidAmount).toBe(350);

          // Player[1] bids 360 (now highest bid)
          playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 360,
          });

          bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.NORMAL);
          expect(bidResult.bidAmount).toBe(360);

          // Player 2 tries ALL_IN (score 350) but current highest bid is 360
          // This should FAIL because 350 <= 360 (current highest bid)
          const errorPromise = utils.waitForEvent(
            playerSockets[2],
            SocketIOEvents.ERROR
          );

          playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.ALL_IN,
            bidAmount: null,
          });

          const errorResult = await errorPromise;
          // Player is auto-skipped because they cannot beat the high bid, so it's not their turn
          expect(errorResult.message).toContain("It's not your turn");
        } finally {
          await cleanup();
        }
      });

      it("should restrict bidding to all-in or pass after someone bids all-in", async () => {
        // Setup with scores where someone can go ALL_IN but NOT reach maxPrice (to avoid auto-win)
        // MaxPrice is 400, so Player[1] ALL_IN with 300 score won't trigger auto-win
        const { setup, cleanup } = await _prepare({
          playerScores: [450, 300, 350], // Player[1] has 300 < maxPrice for ALL_IN without auto-win
          shouldPickQuestion: true,
          pickerIndex: 0, // Player 0 with 450 score picks and starts bidding
        });

        try {
          const { playerSockets, showmanSocket } = setup;

          // Player[0] starts with a small bid (must be >= question price of 200)
          playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 250,
          });
          let bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.NORMAL);
          expect(bidResult.bidAmount).toBe(250);

          // Player[1] goes ALL_IN (300 score, which is less than maxPrice 400)
          playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.ALL_IN,
            bidAmount: null,
          });

          bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.ALL_IN);
          expect(bidResult.bidAmount).toBe(300); // Player[1]'s full score
          expect(bidResult.isPhaseComplete).toBe(false); // Should continue to next bidder
          expect(bidResult.nextBidderId).toBe(
            await utils.getUserIdFromSocket(playerSockets[2])
          );

          // Now Player[2] should only be able to ALL_IN or PASS (not regular numeric bids)
          // Test 1: Player[2] tries to make a regular numeric bid - should be REJECTED
          const errorPromise = utils.waitForEvent(
            playerSockets[2],
            SocketIOEvents.ERROR
          );

          playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.NORMAL,
            bidAmount: 350, // Regular numeric bid
          });

          const errorResult = await errorPromise;
          expect(errorResult.message).toMatch(
            /all.?in.*only|must.*all.?in.*pass|all.?in.*pass.*only/i
          );

          // Test 2: Player[2] can still PASS
          playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.PASS,
            bidAmount: null,
          });

          bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.PASS);
          expect(bidResult.bidAmount).toBe(null);

          // Test 3: Player[0] gets another turn and can only ALL_IN (since their score is 300 < current highest 400)
          // They should be able to pass though
          playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.PASS,
            bidAmount: null,
          });

          bidResult = await utils.waitForEvent<StakeBidSubmitOutputData>(
            showmanSocket,
            SocketIOGameEvents.STAKE_BID_SUBMIT
          );

          expect(bidResult.bidType).toBe(StakeBidType.PASS);
          expect(bidResult.isPhaseComplete).toBe(true); // All players passed, Player[1] wins
        } finally {
          await cleanup();
        }
      });
    });

    describe("Bidding Completion and Winner Determination", () => {
      let setup: GameTestSetup;
      let stakeQuestionId: number;

      beforeEach(async () => {
        setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, gameId, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        // Set player scores to make player[0] the current turn player with sufficient score for manual bidding
        await utils.setPlayerScore(gameId, playerUsers[0].id, 500); // Sufficient score for manual bidding (> maxPrice 400)
        await utils.setPlayerScore(gameId, playerUsers[1].id, 600);
        await utils.setPlayerScore(gameId, playerUsers[2].id, 400);

        // Explicitly set current turn player to player[0] (score changes don't auto-update turn player)
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        stakeQuestionId = await utils.getQuestionIdByType(
          gameId,
          PackageQuestionType.STAKE
        );

        // Player 0 (current turn player) starts stake question
        setup.playerSockets[0].emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId,
        });

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );
      });

      afterEach(async () => {
        await utils.cleanupGameClients(setup);
      });

      it("should complete bidding and announce winner", async () => {
        const { playerSockets, showmanSocket } = setup;

        // Get player IDs
        const player0Id = await utils.getUserIdFromSocket(playerSockets[0]);
        const player1Id = await utils.getUserIdFromSocket(playerSockets[1]);
        const player2Id = await utils.getUserIdFromSocket(playerSockets[2]);

        const winnerPromise = utils.waitForEvent<StakeQuestionWinnerEventData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER
        );

        const questionDataPromise =
          utils.waitForEvent<GameQuestionDataEventPayload>(
            showmanSocket,
            SocketIOGameEvents.QUESTION_DATA
          );

        // Complete all bids: Player 0 -> 250, Player 1 -> 350, Player 2 -> pass, Player 0 -> pass (could outbid but chooses not to)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        });

        // Wait for Player 0's specific bid response
        await new Promise<StakeBidSubmitOutputData>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Timeout waiting for Player 0's bid response"));
          }, 5000);

          const handler = (data: StakeBidSubmitOutputData) => {
            if (data.playerId === player0Id && data.bidAmount === 250) {
              clearTimeout(timeoutId);
              showmanSocket.removeListener(
                SocketIOGameEvents.STAKE_BID_SUBMIT,
                handler
              );
              resolve(data);
            }
          };

          showmanSocket.on(SocketIOGameEvents.STAKE_BID_SUBMIT, handler);
        });

        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 350,
        });

        // Wait for Player 1's specific bid response
        await new Promise<StakeBidSubmitOutputData>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Timeout waiting for Player 1's bid response"));
          }, 5000);

          const handler = (data: StakeBidSubmitOutputData) => {
            if (data.playerId === player1Id && data.bidAmount === 350) {
              clearTimeout(timeoutId);
              showmanSocket.removeListener(
                SocketIOGameEvents.STAKE_BID_SUBMIT,
                handler
              );
              resolve(data);
            }
          };

          showmanSocket.on(SocketIOGameEvents.STAKE_BID_SUBMIT, handler);
        });

        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        // Wait for Player 2's specific pass response
        await new Promise<StakeBidSubmitOutputData>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Timeout waiting for Player 2's pass response"));
          }, 5000);

          const handler = (data: StakeBidSubmitOutputData) => {
            if (
              data.playerId === player2Id &&
              data.bidType === StakeBidType.PASS
            ) {
              clearTimeout(timeoutId);
              showmanSocket.removeListener(
                SocketIOGameEvents.STAKE_BID_SUBMIT,
                handler
              );
              resolve(data);
            }
          };

          showmanSocket.on(SocketIOGameEvents.STAKE_BID_SUBMIT, handler);
        });

        // Player 0 gets another chance but passes (completing the round)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        // Wait for Player 0's final pass bid to be processed - this should complete the phase
        await new Promise<StakeBidSubmitOutputData>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(
              new Error("Timeout waiting for Player 0's final pass response")
            );
          }, 5000);

          const handler = (data: StakeBidSubmitOutputData) => {
            if (
              data.playerId === player0Id &&
              data.bidType === StakeBidType.PASS
            ) {
              clearTimeout(timeoutId);
              showmanSocket.removeListener(
                SocketIOGameEvents.STAKE_BID_SUBMIT,
                handler
              );
              resolve(data);
            }
          };

          showmanSocket.on(SocketIOGameEvents.STAKE_BID_SUBMIT, handler);
        });

        // Should announce Player 1 as winner with bid 350
        const winnerData = await winnerPromise;

        expect(winnerData.winnerPlayerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[1])
        );
        expect(winnerData.finalBid).toBe(350);

        // Question data should be sent separately
        const questionData = await questionDataPromise;
        expect(questionData.data).toBeDefined();
        expect(questionData.data.text).toContain("Stake question");

        // Verify answer timer is included in question data event
        expect(questionData.timer).toBeDefined();
        expect(questionData.timer.durationMs).toBeGreaterThan(0);

        // Verify game state updated
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState?.questionState).toBe(QuestionState.ANSWERING);
      });

      it("should reject first bidder attempt to pass", async () => {
        // Use separate setup for this test
        const { setup, cleanup } = await _prepare({
          playerScores: [500, 600, 400],
          shouldPickQuestion: true,
          pickerIndex: 0,
        });

        try {
          const { playerSockets } = setup;

          // Listen for error on Player 0's socket (the one making the invalid bid)
          const errorPromise = utils.waitForEvent(
            playerSockets[0],
            SocketIOEvents.ERROR
          );

          // First bidder (player 0) tries to pass - should be rejected
          playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
            bidType: StakeBidType.PASS,
            bidAmount: null,
          });

          const error = await errorPromise;
          expect(error.message).toMatch(
            /first.*bidder|cannot.*pass|must.*bid/i
          );
        } finally {
          await cleanup();
        }
      });

      it("should handle single highest bidder scenario", async () => {
        const { playerSockets, showmanSocket } = setup;

        const winnerPromise = utils.waitForEvent<StakeQuestionWinnerEventData>(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_WINNER
        );

        // Player 0 bids 250 (must be >= question price of 200), others pass
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        });

        // Wait for the final pass bid to be processed
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        const winnerData = await winnerPromise;
        expect(winnerData.winnerPlayerId).toBe(
          await utils.getUserIdFromSocket(playerSockets[0])
        );
        expect(winnerData.finalBid).toBe(250);
      });
    });
  });
});
