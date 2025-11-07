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
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import {
  GameTestSetup,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

describe("Stake Question Validation Tests", () => {
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
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
  });

  /**
   * Helper function to prepare stake question test environment
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
      playerScores = [500, 600, 400],
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
      const score = playerScores[i] || 500;
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

  describe("Normal numeric bids below question price should be rejected", () => {
    it("should reject normal numeric bid that is below question price", async () => {
      // Setup: Player with sufficient score (1000) but tries to bid below question price (200)
      const { setup, cleanup } = await _prepare({
        playerScores: [1000, 600, 400], // Player 0 has enough to bid properly
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

        // Player 0 tries to bid 150 (below question price of 200)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 150, // Below question price of 200
        } as StakeBidSubmitInputData);

        // Should receive an error
        const error = await errorPromise;
        expect(error.message).toMatch(/below.*question.*price/i);
      } finally {
        await cleanup();
      }
    });

    it("should accept normal numeric bid equal to question price", async () => {
      // Setup: Player with sufficient score tries to bid exactly the question price
      const { setup, cleanup } = await _prepare({
        playerScores: [1000, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Listen for successful bid submission
        const bidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 bids exactly the question price (200)
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 200, // Equal to question price
        } as StakeBidSubmitInputData);

        // Should succeed
        const result = await bidPromise;
        expect(result.bidAmount).toBe(200);
        expect(result.bidType).toBe(StakeBidType.NORMAL);
      } finally {
        await cleanup();
      }
    });

    it("should accept normal numeric bid above question price", async () => {
      // Setup: Player with sufficient score bids above question price
      const { setup, cleanup } = await _prepare({
        playerScores: [1000, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Listen for successful bid submission
        const bidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 0 bids above the question price
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 250, // Above question price of 200
        } as StakeBidSubmitInputData);

        // Should succeed
        const result = await bidPromise;
        expect(result.bidAmount).toBe(250);
        expect(result.bidType).toBe(StakeBidType.NORMAL);
      } finally {
        await cleanup();
      }
    });
  });

  describe("Players who already passed should not be able to bid again", () => {
    it("should reject any bid from player who already passed", async () => {
      // Setup normal game and have a player pass, then try to bid again
      const { setup, cleanup } = await _prepare({
        playerScores: [500, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Player 0 makes initial bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 220,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 1 passes
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 2 makes a bid to continue the round
        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 240,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Now it's back to Player 0's turn, but if Player 1 (who passed) tries to bid, it should fail
        // Listen for error on Player 1's socket
        const errorPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOEvents.ERROR
        );

        // Player 1 (who already passed) tries to bid again
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 260,
        } as StakeBidSubmitInputData);

        // Should receive an error
        const error = await errorPromise;
        expect(error.message).toMatch(/already.*passed|cannot.*bid/i);
      } finally {
        await cleanup();
      }
    });

    it("should reject ALL_IN bid from player who already passed", async () => {
      // Similar setup but player tries ALL_IN after passing
      const { setup, cleanup } = await _prepare({
        playerScores: [500, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Player 0 makes initial bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 220,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 1 passes
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 2 makes a bid
        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 240,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Listen for error on Player 1's socket
        const errorPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOEvents.ERROR
        );

        // Player 1 (who already passed) tries to go ALL_IN
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.ALL_IN,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        // Should receive an error
        const error = await errorPromise;
        expect(error.message).toMatch(/already.*passed|cannot.*bid/i);
      } finally {
        await cleanup();
      }
    });

    it("should reject PASS bid from player who already passed", async () => {
      // Player who already passed tries to pass again
      const { setup, cleanup } = await _prepare({
        playerScores: [500, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets, showmanSocket } = setup;

        // Player 0 makes initial bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 220,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 1 passes
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Player 2 makes a bid
        playerSockets[2].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 240,
        } as StakeBidSubmitInputData);

        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_BID_SUBMIT
        );

        // Listen for error on Player 1's socket
        const errorPromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOEvents.ERROR
        );

        // Player 1 (who already passed) tries to pass again
        playerSockets[1].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.PASS,
          bidAmount: null,
        } as StakeBidSubmitInputData);

        // Should receive an error
        const error = await errorPromise;
        expect(error.message).toMatch(/already.*passed|cannot.*bid/i);
      } finally {
        await cleanup();
      }
    });
  });

  describe("Edge cases validation", () => {
    it("should reject negative bid amounts", async () => {
      const { setup, cleanup } = await _prepare({
        playerScores: [1000, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets } = setup;

        // Listen for error
        const errorPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Try negative bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: -100,
        } as StakeBidSubmitInputData);

        const error = await errorPromise;
        expect(error.message).toMatch(
          /ValidationError.*greater than or equal to 1/i
        );
      } finally {
        await cleanup();
      }
    });

    it("should reject zero bid amounts", async () => {
      const { setup, cleanup } = await _prepare({
        playerScores: [1000, 600, 400],
        shouldPickQuestion: true,
        pickerIndex: 0,
      });

      try {
        const { playerSockets } = setup;

        // Listen for error
        const errorPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOEvents.ERROR
        );

        // Try zero bid
        playerSockets[0].emit(SocketIOGameEvents.STAKE_BID_SUBMIT, {
          bidType: StakeBidType.NORMAL,
          bidAmount: 0,
        } as StakeBidSubmitInputData);

        const error = await errorPromise;
        expect(error.message).toMatch(
          /ValidationError.*greater than or equal to 1/i
        );
      } finally {
        await cleanup();
      }
    });
  });
});
