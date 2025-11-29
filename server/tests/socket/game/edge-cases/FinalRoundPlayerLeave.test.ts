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

import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  FinalAnswerSubmitInputData,
  FinalAutoLossEventData,
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
  FinalSubmitEndEventData,
} from "domain/types/socket/events/FinalRoundEventData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { TestUtils } from "tests/utils/TestUtils";

describe("Final Round Player Leave", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: TestUtils;
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
    utils = new TestUtils(app, userRepo, serverUrl);
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

  describe("Theme Elimination Phase", () => {
    it("should auto-eliminate random theme when turn player leaves during their elimination turn", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Verify we're in final round theme elimination
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);
        expect(finalState!.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(finalState!.currentTurnPlayerId).toBeDefined();

        const turnPlayerId = finalState!.currentTurnPlayerId!;
        const turnPlayerIndex = playerUsers.findIndex(
          (u) => u.id === turnPlayerId
        );
        const turnPlayerSocket = playerSockets[turnPlayerIndex];

        // Count themes before
        const themesBefore = finalState!.currentRound!.themes.filter(
          (t) => !t.questions?.some((q) => q.isPlayed)
        );
        const themesCountBefore = themesBefore.length;

        // Set up listener for theme elimination event
        const themeEliminatePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.THEME_ELIMINATE,
          10000
        );

        // Turn player leaves - should trigger auto-elimination
        turnPlayerSocket.emit(SocketIOGameEvents.LEAVE);

        // Should get theme elimination event
        const eliminateData = await themeEliminatePromise;
        expect(eliminateData.themeId).toBeDefined();

        // Verify a theme was eliminated
        const stateAfter = await utils.getGameState(gameId);
        const themesAfter = stateAfter!.currentRound!.themes.filter(
          (t) => !t.questions?.some((q) => q.isPlayed)
        );
        expect(themesAfter.length).toBe(themesCountBefore - 1);

        // Verify turn moved to next player
        expect(stateAfter!.currentTurnPlayerId).toBeDefined();
        expect(stateAfter!.currentTurnPlayerId).not.toBe(turnPlayerId);

        // Verify turn player exists and is in game
        const gameAfter = await utils.getGameFromGameService(gameId);
        const newTurnPlayer = gameAfter.getPlayer(
          stateAfter!.currentTurnPlayerId!,
          { fetchDisconnected: false }
        );
        expect(newTurnPlayer).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Bidding Phase", () => {
    it("should auto-bid 0 when player leaves during bidding phase and remove from answerers list", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000], // All players eligible to bid
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Complete theme elimination to reach bidding phase
        const phaseTransitionPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );
        await phaseTransitionPromise;

        // Verify we're in bidding phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(gameState.questionState).toBe(QuestionState.BIDDING);

        // Track bid submission events
        const bidEvents: FinalBidSubmitOutputData[] = [];
        showmanSocket.on(
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          (data: FinalBidSubmitOutputData) => {
            bidEvents.push(data);
          }
        );

        // Player 0 and Player 1 submit bids normally
        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        });
        await firstBidPromise;

        const secondBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
        });
        await secondBidPromise;

        // Player 2 leaves without bidding
        const leavePlayerId = playerUsers[2].id;

        // Set up listener for automatic bid = 0
        const autoBidPromise = utils.waitForEvent<FinalBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          5000
        );

        playerSockets[2].emit(SocketIOGameEvents.LEAVE);

        // Should get automatic bid of 0 for the leaving player
        const autoBidData = await autoBidPromise;
        expect(autoBidData.playerId).toBe(leavePlayerId);
        expect(autoBidData.bidAmount).toBe(0);

        // Verify game state shows bid of 0 for leaving player
        gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.bids[leavePlayerId]).toBe(0);

        // Verify player was removed from game
        const game = await utils.getGameFromGameService(gameId);
        expect(game.hasPlayer(leavePlayerId)).toBe(false);

        // Verify phase transitioned to answering automatically after all bids
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);

        // Verify the leaving player is NOT in the list of players who need to answer
        const finalRoundData = gameState.finalRoundData!;
        const playerIdsWithBids = Object.keys(finalRoundData.bids).map(Number);

        // Only players with non-zero bids should be expected to answer
        const playersWhoShouldAnswer = playerIdsWithBids.filter(
          (playerId) => finalRoundData.bids[playerId] > 0
        );

        expect(playersWhoShouldAnswer).not.toContain(leavePlayerId);
        expect(playersWhoShouldAnswer).toHaveLength(2); // Only player 0 and 1
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle bidding timeout after player leaves with bid 0", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Complete theme elimination
        const phaseTransitionPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );
        await phaseTransitionPromise;

        // Player 2 leaves immediately
        const leavePlayerId = playerUsers[2].id;
        const autoBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[2].emit(SocketIOGameEvents.LEAVE);
        await autoBidPromise;

        // Wait for timer to expire (should auto-bid 1 for remaining non-bidders)
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        // Verify game state
        await utils.expireTimer(gameId);
        await questionDataPromise;

        const gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        // Verify all bids are present
        const bids = gameState.finalRoundData?.bids;
        expect(bids![playerUsers[0].id]).toBe(1); // Timeout bid
        expect(bids![playerUsers[1].id]).toBe(1); // Timeout bid
        expect(bids![leavePlayerId]).toBe(0); // Left player
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Answering Phase", () => {
    it("should submit empty answer and auto-loss immediately when player leaves, then wait for timer for remaining players", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Complete theme elimination
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );

        // Submit all bids
        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        } satisfies FinalBidSubmitInputData);
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
        } satisfies FinalBidSubmitInputData);
        playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 500,
        } satisfies FinalBidSubmitInputData);
        await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        // Player 0 submits answer
        const firstAnswerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Test answer",
        } satisfies FinalAnswerSubmitInputData);

        await firstAnswerPromise;

        // Player 2 leaves without submitting answer
        const leavePlayerId = playerUsers[2].id;

        // Listen for the answer submission (empty) and auto-loss event
        const answerSubmitPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        const autoLossPromise = utils.waitForEvent<FinalAutoLossEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_AUTO_LOSS
        );

        playerSockets[2].emit(SocketIOGameEvents.LEAVE);

        // Should receive empty answer submission
        const answerData = await answerSubmitPromise;
        expect(answerData.playerId).toBe(leavePlayerId);

        // Should receive auto-loss event
        const autoLossData = await autoLossPromise;
        expect(autoLossData.playerId).toBe(leavePlayerId);

        // Verify answer was recorded in game state
        gameState = await utils.getGameState(gameId);
        const leavingPlayerAnswer = gameState.finalRoundData?.answers.find(
          (ans) => ans.playerId === leavePlayerId
        );
        expect(leavingPlayerAnswer).toBeDefined();
        expect(leavingPlayerAnswer!.answer).toBe("");
        expect(leavingPlayerAnswer!.autoLoss).toBe(true);

        // Verify player was removed from game
        const game = await utils.getGameFromGameService(gameId);
        expect(game.hasPlayer(leavePlayerId)).toBe(false);

        // Setup listener before expiring timer
        const phaseCompletePromise =
          utils.waitForEvent<FinalSubmitEndEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END
          );

        // Now expire the timer (player 1 hasn't answered yet)
        await utils.expireTimer(gameId);

        // Should transition to reviewing phase
        const phaseData = await phaseCompletePromise;
        expect(phaseData.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(phaseData.nextPhase).toBe(FinalRoundPhase.REVIEWING);

        // Verify all players have answers (including timer-expired player 1)
        gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.answers).toHaveLength(3);

        // Verify phase is now reviewing
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

        // Validate that left player (player 2) has empty answer and auto-loss
        const leftPlayerAnswer = gameState.finalRoundData?.answers.find(
          (ans) => ans.playerId === playerUsers[2].id
        );
        expect(leftPlayerAnswer).toBeDefined();
        expect(leftPlayerAnswer!.answer).toBe("");
        expect(leftPlayerAnswer!.autoLoss).toBe(true);

        // Validate that timed-out player (player 1) has empty answer and auto-loss
        const timedOutPlayerAnswer = gameState.finalRoundData?.answers.find(
          (ans) => ans.playerId === playerUsers[1].id
        );
        expect(timedOutPlayerAnswer).toBeDefined();
        expect(timedOutPlayerAnswer!.answer).toBe("");
        expect(timedOutPlayerAnswer!.autoLoss).toBe(true);

        // Verify player 0 (who submitted) has their answer and no auto-loss
        const submittedPlayerAnswer = gameState.finalRoundData?.answers.find(
          (ans) => ans.playerId === playerUsers[0].id
        );
        expect(submittedPlayerAnswer).toBeDefined();
        expect(submittedPlayerAnswer!.answer).toBe("Test answer");
        expect(submittedPlayerAnswer!.autoLoss).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle immediate phase transition when all remaining players answered and last one leaves", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        // Navigate to answering phase
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );

        const questionDataPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        });
        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
        });
        playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 500,
        });
        await questionDataPromise;

        // Players 0 and 1 submit answers
        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Answer 1",
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );

        playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Answer 2",
        });
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );

        // Player 2 leaves - should trigger immediate phase transition
        const phaseCompletePromise =
          utils.waitForEvent<FinalSubmitEndEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_SUBMIT_END,
            2000
          );

        playerSockets[2].emit(SocketIOGameEvents.LEAVE);

        // Wait for auto-loss submission
        await utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );

        // Should immediately transition to reviewing
        const phaseData = await phaseCompletePromise;
        expect(phaseData.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(phaseData.nextPhase).toBe(FinalRoundPhase.REVIEWING);
        expect(phaseData.allReviews).toBeDefined();
        expect(phaseData.allReviews).toHaveLength(3);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Join Restrictions", () => {
    it("should not allow new player to join as PLAYER during final round", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { gameId } = setup;

      try {
        // Verify we're in final round
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);

        // Try to join as player
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const errorPromise = new Promise((resolve) => {
          newPlayerSocket.once(SocketIOEvents.ERROR, resolve);
          setTimeout(() => resolve(null), 3000);
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER,
        });

        const error = await errorPromise;
        expect(error).toBeDefined();

        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow new spectator to join during final round", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { gameId } = setup;

      try {
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);

        // Join as spectator should work
        const { socket: spectatorSocket } = await utils.createGameClient();

        await utils.joinGame(spectatorSocket, gameId, PlayerRole.SPECTATOR);

        // Verify spectator is in game
        const gameAfterJoin = await utils.getGameFromGameService(gameId);
        const spectators = gameAfterJoin.players.filter(
          (p) => p.role === PlayerRole.SPECTATOR
        );
        expect(spectators.length).toBeGreaterThan(0);

        await utils.disconnectAndCleanup(spectatorSocket);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
