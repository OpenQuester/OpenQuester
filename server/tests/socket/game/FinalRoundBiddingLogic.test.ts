import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { TestUtils } from "../../utils/TestUtils";

describe("Final Round Bidding Logic", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: TestUtils;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new TestUtils(app, userRepo, serverUrl);
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
    await RedisConfig.disconnect();
  });

  describe("Basic Bidding Flow", () => {
    it("should transition to bidding phase and start timer after theme elimination", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200], // Both players have scores > 1
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
      let phaseCompleteEvent: FinalPhaseCompleteEventData | null = null;

      // Listen for phase transition event
      showmanSocket.on(
        SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        (data: FinalPhaseCompleteEventData) => {
          if (
            data.phase === FinalRoundPhase.THEME_ELIMINATION &&
            data.nextPhase === FinalRoundPhase.BIDDING
          ) {
            phaseCompleteEvent = data;
          }
        }
      );

      // Complete theme elimination to trigger bidding phase
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      // Verify phase transition event was received
      expect(phaseCompleteEvent).not.toBeNull();
      expect(phaseCompleteEvent!.phase).toBe(FinalRoundPhase.THEME_ELIMINATION);
      expect(phaseCompleteEvent!.nextPhase).toBe(FinalRoundPhase.BIDDING);
      expect(phaseCompleteEvent!.timer).toBeDefined();
      expect(phaseCompleteEvent!.timer!.durationMs).toBe(45000); // 45 seconds

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should automatically bid 1 for players with score <= 1", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 4,
        playerScores: [1500, 1, 0, -500], // One normal score, three low scores
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
      const automaticBidEvents: FinalBidSubmitOutputData[] = [];

      // Listen for automatic bid events
      showmanSocket.on(
        SocketIOGameEvents.FINAL_BID_SUBMIT,
        (data: FinalBidSubmitOutputData) => {
          if (data.isAutomatic) {
            automaticBidEvents.push(data);
          }
        }
      );

      // Complete theme elimination and transition to bidding
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Verify automatic bids were placed for players with score <= 1
      expect(automaticBidEvents).toHaveLength(3);
      automaticBidEvents.forEach((bidEvent) => {
        expect(bidEvent.bidAmount).toBe(1);
        expect(bidEvent.isAutomatic).toBe(true);
        expect(bidEvent.playerId).toBeDefined();
      });

      // Verify game state shows the automatic bids
      const gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
      expect(Object.keys(gameState.finalRoundData?.bids || {})).toHaveLength(3);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should transition to question phase when all remaining players submit bids", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1, 1200], // Two players need to bid manually, one auto-bids
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
      let questionDataEvent: FinalQuestionEventData | null = null;

      // Listen for question data event
      showmanSocket.on(
        SocketIOGameEvents.FINAL_QUESTION_DATA,
        (data: FinalQuestionEventData) => {
          questionDataEvent = data;
        }
      );

      // Complete theme elimination and transition to bidding
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Submit bids from players who need to bid manually (players 0 and 2)
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
      await utils.wait(50);

      playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
      await utils.wait(50);

      // Verify transition to question phase
      expect(questionDataEvent).not.toBeNull();
      expect(questionDataEvent!.questionData).toBeDefined();
      expect(questionDataEvent!.questionData.themeId).toBeDefined();
      expect(questionDataEvent!.questionData.themeName).toBeDefined();
      expect(questionDataEvent!.questionData.question).toBeDefined();

      // Verify game state
      const gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should immediately transition to question phase when all players have score <= 1", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1, 0, -100], // All players have low scores
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
      const automaticBidEvents: FinalBidSubmitOutputData[] = [];
      let questionDataEvent: FinalQuestionEventData | null = null;

      // Listen for automatic bid events
      showmanSocket.on(
        SocketIOGameEvents.FINAL_BID_SUBMIT,
        (data: FinalBidSubmitOutputData) => {
          if (data.isAutomatic) {
            automaticBidEvents.push(data);
          }
        }
      );

      // Listen for question data event
      showmanSocket.on(
        SocketIOGameEvents.FINAL_QUESTION_DATA,
        (data: FinalQuestionEventData) => {
          questionDataEvent = data;
        }
      );

      // Complete theme elimination and transition to bidding
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Verify all players auto-bid
      expect(automaticBidEvents).toHaveLength(3);
      automaticBidEvents.forEach((bidEvent) => {
        expect(bidEvent.bidAmount).toBe(1);
        expect(bidEvent.isAutomatic).toBe(true);
      });

      // Verify immediate transition to question phase
      expect(questionDataEvent).not.toBeNull();
      expect(questionDataEvent!.questionData).toBeDefined();

      // Verify game state
      const gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
      expect(Object.values(gameState.finalRoundData?.bids || {})).toEqual([
        1, 1, 1,
      ]);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should allow showman to eliminate themes on behalf of current turn player", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200], // Both players have scores > 1
      });

      const { showmanSocket, playerSockets, gameId } = setupResult;
      const eliminationEvents: ThemeEliminateOutputData[] = [];

      // Listen for theme elimination events
      showmanSocket.on(
        SocketIOGameEvents.THEME_ELIMINATE,
        (data: ThemeEliminateOutputData) => {
          eliminationEvents.push(data);
        }
      );

      // Get initial game state to find available themes
      const initialGameState = await utils.getGameState(gameId);
      const availableThemes = initialGameState.currentRound?.themes || [];
      expect(availableThemes.length).toBeGreaterThan(1);

      // Showman eliminates first theme (acting on behalf of current turn player)
      showmanSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: availableThemes[0].id,
      });
      await utils.wait(50);

      // Verify elimination event was received
      expect(eliminationEvents).toHaveLength(1);
      expect(eliminationEvents[0].themeId).toBe(availableThemes[0].id);
      expect(eliminationEvents[0].eliminatedBy).toBeDefined();
      expect(eliminationEvents[0].nextPlayerId).toBeDefined();

      // Showman eliminates second theme (acting on behalf of next turn player)
      showmanSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: availableThemes[1].id,
      });
      await utils.wait(50);

      // Verify second elimination event
      expect(eliminationEvents).toHaveLength(2);
      expect(eliminationEvents[1].themeId).toBe(availableThemes[1].id);

      // Continue eliminating until only one theme remains
      for (let i = 2; i < availableThemes.length - 1; i++) {
        showmanSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
          themeId: availableThemes[i].id,
        });
        await utils.wait(50);
      }

      // Wait for phase transition to bidding
      await utils.wait(50);

      // Verify final state
      const finalGameState = await utils.getGameState(gameId);
      expect(finalGameState.finalRoundData?.phase).toBe(
        FinalRoundPhase.BIDDING
      );

      // Verify only one theme remains (not eliminated)
      const eliminatedThemeIds =
        finalGameState.finalRoundData?.eliminatedThemes || [];
      const remainingThemes = availableThemes.filter(
        (t) => !eliminatedThemeIds.includes(t.id)
      );
      expect(remainingThemes).toHaveLength(1);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });
  });

  describe("Invalid Bidding Scenarios", () => {
    it("should reject a bid that is higher than the player's score", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 1,
        playerScores: [500],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Player tries to bid more than they have
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 501 });
      await utils.wait(50);

      // Verify the bid was not accepted (should be normalized or rejected)
      const gameState = await utils.getGameState(gameId);
      // The bid should either not exist or be normalized to the player's max score
      const playerDBId = playerUsers[0].id;
      const actualBid = gameState.finalRoundData?.bids[playerDBId];
      expect(actualBid === undefined || actualBid <= 500).toBe(true);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should reject a bid of zero or a negative number", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 1,
        playerScores: [500],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Player tries to bid zero
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 0 });
      await utils.wait(50);

      // Verify the bid was normalized to minimum (1) or rejected
      let gameState = await utils.getGameState(gameId);
      const playerDBId = playerUsers[0].id;
      let actualBid = gameState.finalRoundData?.bids[playerDBId];
      expect(actualBid === undefined || actualBid >= 1).toBe(true);

      // Player tries to bid a negative number
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: -100 });
      await utils.wait(50);

      // Verify the bid was normalized to minimum (1) or rejected
      gameState = await utils.getGameState(gameId);
      actualBid = gameState.finalRoundData?.bids[playerDBId];
      expect(actualBid === undefined || actualBid >= 1).toBe(true);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });

    it("should not allow a player to bid twice", async () => {
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 1,
        playerScores: [500],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await utils.wait(50);

      // Player submits a valid bid
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 100 });
      await utils.wait(50);

      // Verify the bid was accepted
      let gameState = await utils.getGameState(gameId);
      const playerDBId = playerUsers[0].id;
      expect(gameState.finalRoundData?.bids[playerDBId]).toBe(100);

      // Player tries to submit another bid
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 200 });
      await utils.wait(50);

      // Verify the bid was not changed (should remain 100)
      gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.bids[playerDBId]).toBe(100);

      // Clean up
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
      setupResult.spectatorSocket.disconnect();
    });
  });
});
