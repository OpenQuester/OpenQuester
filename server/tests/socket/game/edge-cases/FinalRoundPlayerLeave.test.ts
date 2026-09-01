import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload,
  ThemeEliminateOutputData
} from "domain/types/socket/events/FinalRoundEventData";
import { GameLeaveBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TestUtils } from "tests/utils/TestUtils";

describe("Final Round Player Leave", () => {
  let suite: SocketGameTestSuite;
  let utils: TestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    utils = suite.testUtils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Theme Elimination Phase", () => {
    it("should auto-eliminate random theme when turn player leaves during their elimination turn", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Verify we're in final round theme elimination
      const finalState = await utils.getGameState(gameId);
      expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);
      expect(finalState!.questionState).toBe(QuestionState.THEME_ELIMINATION);
      expect(finalState!.currentTurnPlayerId).toBeDefined();

      const turnPlayerId = finalState!.currentTurnPlayerId!;
      const turnPlayerIndex = playerUsers.findIndex((u) => u.id === turnPlayerId);
      const turnPlayerSocket = playerSockets[turnPlayerIndex];

      // Count themes before
      const themesBefore = finalState!.currentRound!.themes.filter(
        (t) => !t.questions?.some((q) => q.isPlayed)
      );
      const themesCountBefore = themesBefore.length;

      const themeEliminatePromise = suite.utils.waitForEventMatching<ThemeEliminateOutputData>(
        showmanSocket,
        SocketIOGameEvents.THEME_ELIMINATE,
        (data) => data.eliminatedBy === SYSTEM_PLAYER_ID
      );
      const spectatorThemeEliminatePromise =
        suite.utils.waitForEventMatching<ThemeEliminateOutputData>(
          setup.spectatorSockets[0],
          SocketIOGameEvents.THEME_ELIMINATE,
          (data) => data.eliminatedBy === SYSTEM_PLAYER_ID
        );
      const leavePromise = suite.utils.waitForEventMatching<GameLeaveBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.LEAVE,
        (data) => data.user === turnPlayerId
      );

      // Turn player leaves - should trigger system auto-elimination.
      turnPlayerSocket.emit(SocketIOGameEvents.LEAVE);

      const [eliminateData, spectatorEliminateData, leaveData] = await Promise.all([
        themeEliminatePromise,
        spectatorThemeEliminatePromise,
        leavePromise
      ]);

      expect(leaveData).toEqual({ user: turnPlayerId });
      expect(eliminateData).toEqual({
        themeId: expect.any(Number),
        eliminatedBy: SYSTEM_PLAYER_ID,
        nextPlayerId: expect.any(Number)
      });
      expect(spectatorEliminateData).toEqual(eliminateData);

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
      const newTurnPlayer = gameAfter.getPlayer(stateAfter!.currentTurnPlayerId!, {
        fetchDisconnected: false
      });
      expect(newTurnPlayer).toBeDefined();
    });
  });

  describe("Bidding Phase", () => {
    it("should auto-bid 1 when player leaves during bidding phase and remove from answerers list", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000] // All players eligible to bid
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Complete theme elimination to reach bidding phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await phaseTransitionPromise;

      // Verify we're in bidding phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
      expect(gameState.questionState).toBe(QuestionState.BIDDING);

      // Player 0 and Player 1 submit bids normally
      const firstBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 800
      });
      await firstBidPromise;

      const secondBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 600
      });
      await secondBidPromise;

      // Player 2 leaves without bidding
      const leavePlayerId = playerUsers[2].id;

      const autoBidPromise = suite.utils.waitForEventMatching<FinalBidSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT,
        (data) => data.playerId === leavePlayerId
      );
      const leavePromise = suite.utils.waitForEventMatching<GameLeaveBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.LEAVE,
        (data) => data.user === leavePlayerId
      );

      playerSockets[2].emit(SocketIOGameEvents.LEAVE);

      const [autoBidData, leaveData] = await Promise.all([autoBidPromise, leavePromise]);
      expect(leaveData).toEqual({ user: leavePlayerId });
      expect(autoBidData).toEqual({
        playerId: leavePlayerId,
        bidAmount: 1,
        isAutomatic: true
      });

      // Verify game state shows bid of 1 for leaving player
      gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.bids[leavePlayerId]).toBe(1);

      // Verify player was removed from game
      const game = await utils.getGameFromGameService(gameId);
      expect(game.hasPlayer(leavePlayerId)).toBe(false);

      // Verify phase transitioned to answering automatically after all bids
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
      expect(gameState.questionState).toBe(QuestionState.ANSWERING);

      // Verify the leaving player IS in the list of players who need to answer
      // (bid=1 allows them to reconnect and continue, or get auto-loss if they don't)
      const finalRoundData = gameState.finalRoundData!;
      const playerIdsWithBids = Object.keys(finalRoundData.bids).map(Number);

      // All players with non-zero bids should be expected to answer
      const playersWhoShouldAnswer = playerIdsWithBids.filter(
        (playerId) => finalRoundData.bids[playerId] > 0
      );

      // All 3 players have bids > 0 (800, 600, 1) so all need to answer
      expect(playersWhoShouldAnswer).toContain(leavePlayerId);
      expect(playersWhoShouldAnswer).toHaveLength(3);
    });

    it("should handle bidding timeout after player leaves with bid 1", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Complete theme elimination
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await phaseTransitionPromise;

      // Player 2 leaves immediately
      const leavePlayerId = playerUsers[2].id;
      const autoBidPromise = suite.utils.waitForEventMatching<FinalBidSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT,
        (data) => data.playerId === leavePlayerId
      );
      playerSockets[2].emit(SocketIOGameEvents.LEAVE);
      expect(await autoBidPromise).toEqual({
        playerId: leavePlayerId,
        bidAmount: 1,
        isAutomatic: true
      });

      // Wait for timer to expire (should auto-bid 1 for remaining non-bidders)
      const questionDataPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_QUESTION_DATA
      );

      // Verify game state
      await utils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_BIDDING_EXPIRED);
      await questionDataPromise;

      const gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Verify all bids are present
      const bids = gameState.finalRoundData?.bids;
      expect(bids![playerUsers[0].id]).toBe(1); // Timeout bid
      expect(bids![playerUsers[1].id]).toBe(1); // Timeout bid
      expect(bids![leavePlayerId]).toBe(1); // Left player gets bid=1
    });
  });

  describe("Answering Phase", () => {
    it("should submit empty answer and auto-loss immediately when player leaves, then wait for timer for remaining players", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Complete theme elimination
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      // Submit bids sequentially to reach answering phase
      const questionDataPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_QUESTION_DATA
      );

      const firstBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 800
      } satisfies FinalBidSubmitInputData);
      await firstBidPromise;

      const secondBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 600
      } satisfies FinalBidSubmitInputData);
      await secondBidPromise;

      playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 500
      } satisfies FinalBidSubmitInputData);

      await questionDataPromise;

      // Verify we're in answering phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Player 0 submits answer
      const firstAnswerPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === playerUsers[0].id
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Test answer"
      } satisfies FinalAnswerSubmitInputData);

      expect(await firstAnswerPromise).toEqual({ playerId: playerUsers[0].id });

      // Player 2 leaves without submitting answer
      const leavePlayerId = playerUsers[2].id;

      // Listen for the answer submission (empty) and auto-loss event
      const answerSubmitPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === leavePlayerId
      );
      const autoLossPromise = suite.utils.waitForEventMatching<SocketIOFinalAutoLossEventPayload>(
        showmanSocket,
        SocketIOGameEvents.FINAL_AUTO_LOSS,
        (data) => data.playerId === leavePlayerId
      );
      const leavePromise = suite.utils.waitForEventMatching<GameLeaveBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.LEAVE,
        (data) => data.user === leavePlayerId
      );

      playerSockets[2].emit(SocketIOGameEvents.LEAVE);

      const [answerData, autoLossData, leaveData] = await Promise.all([
        answerSubmitPromise,
        autoLossPromise,
        leavePromise
      ]);

      expect(leaveData).toEqual({ user: leavePlayerId });
      expect(answerData).toEqual({ playerId: leavePlayerId });
      expect(autoLossData).toEqual({
        playerId: leavePlayerId,
        reason: FinalAnswerLossReason.EMPTY_ANSWER
      });

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
      const phaseCompletePromise = utils.waitForEvent<FinalSubmitEndEventData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_SUBMIT_END
      );

      // Now expire the timer (player 1 hasn't answered yet)
      await utils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_FINAL_ANSWERING_EXPIRED);

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
    });

    it("should handle immediate phase transition when all remaining players answered and last one leaves", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Navigate to answering phase
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      const questionDataPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_QUESTION_DATA
      );

      const firstBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 800
      });
      await firstBidPromise;

      const secondBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 600
      });
      await secondBidPromise;

      playerSockets[2].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 500
      });
      await questionDataPromise;

      // Players 0 and 1 submit answers
      const firstAnswerPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === playerUsers[0].id
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Answer 1"
      });
      expect(await firstAnswerPromise).toEqual({ playerId: playerUsers[0].id });

      const secondAnswerPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === playerUsers[1].id
      );
      playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Answer 2"
      });
      expect(await secondAnswerPromise).toEqual({ playerId: playerUsers[1].id });

      // Player 2 leaves - should trigger immediate phase transition
      const phaseCompletePromise = utils.waitForEvent<FinalSubmitEndEventData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_SUBMIT_END
      );
      const autoLossAnswerPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === playerUsers[2].id
      );

      playerSockets[2].emit(SocketIOGameEvents.LEAVE);

      // Wait for auto-loss submission
      expect(await autoLossAnswerPromise).toEqual({ playerId: playerUsers[2].id });

      // Should immediately transition to reviewing
      const phaseData = await phaseCompletePromise;
      expect(phaseData.phase).toBe(FinalRoundPhase.ANSWERING);
      expect(phaseData.nextPhase).toBe(FinalRoundPhase.REVIEWING);
      expect(phaseData.allReviews).toBeDefined();
      expect(phaseData.allReviews).toHaveLength(3);
    });

    it("should reject duplicate final answer submission", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Complete theme elimination
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

      // Submit bids to reach answering phase
      const questionDataPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_QUESTION_DATA
      );

      const firstBidPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 800
      });
      await firstBidPromise;

      playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
        bid: 600
      });
      await questionDataPromise;

      // Verify we're in answering phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

      // Player 0 submits first answer - should succeed
      const firstAnswerPromise = suite.utils.waitForEventMatching<FinalAnswerSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        (data) => data.playerId === playerUsers[0].id
      );
      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "First answer"
      } as FinalAnswerSubmitInputData);
      expect(await firstAnswerPromise).toEqual({ playerId: playerUsers[0].id });

      // Verify answer was recorded
      gameState = await utils.getGameState(gameId);
      const player0Answer = gameState.finalRoundData?.answers.find(
        (ans) => ans.playerId === playerUsers[0].id
      );
      expect(player0Answer).toBeDefined();
      expect(player0Answer!.answer).toBe("First answer");

      // Player 0 tries to submit second answer - should fail
      const errorPromise = utils.waitForEvent<unknown>(playerSockets[0], SocketIOEvents.ERROR);

      playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
        answerText: "Second answer - should fail"
      } as FinalAnswerSubmitInputData);

      const error = (await errorPromise) as { message?: string };
      expect(error).toBeDefined();
      expect(error.message).toContain("already answered");

      // Verify first answer is still preserved
      gameState = await utils.getGameState(gameId);
      const preservedAnswer = gameState.finalRoundData?.answers.find(
        (ans) => ans.playerId === playerUsers[0].id
      );
      expect(preservedAnswer!.answer).toBe("First answer");
    });
  });

  describe("Join Restrictions", () => {
    it("should not allow new player to join as PLAYER during final round", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200]
      });

      const { gameId } = setup;

      // Verify we're in final round
      const finalState = await utils.getGameState(gameId);
      expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);

      // Try to join as player
      const { socket: newPlayerSocket } = await utils.createGameClient();

      const errorPromise = utils.waitForEvent<unknown>(newPlayerSocket, SocketIOEvents.ERROR);

      newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER
      });

      const error = (await errorPromise) as { message?: string };
      expect(error).toBeDefined();
    });

    it("should allow new spectator to join during final round", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200]
      });

      const { gameId } = setup;

      const finalState = await utils.getGameState(gameId);
      expect(finalState!.currentRound?.type).toBe(PackageRoundType.FINAL);

      // Join as spectator should work
      const { socket: spectatorSocket } = await utils.createGameClient();

      await utils.joinGame(spectatorSocket, gameId, PlayerRole.SPECTATOR);

      // Verify spectator is in game
      const gameAfterJoin = await utils.getGameFromGameService(gameId);
      const spectators = gameAfterJoin.players.filter((p) => p.role === PlayerRole.SPECTATOR);
      expect(spectators.length).toBeGreaterThan(0);
    });

    it("should allow existing player to rejoin during final round bidding", async () => {
      const setup = await utils.setupFinalRoundGame({
        playersCount: 3,
        playerScores: [1500, 1200, 1000]
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Complete theme elimination to reach bidding phase
      const phaseTransitionPromise = utils.waitForEvent(
        playerSockets[0],
        SocketIOGameEvents.FINAL_PHASE_COMPLETE
      );
      await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
      await phaseTransitionPromise;

      // Verify we're in bidding phase
      let gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
      expect(gameState.questionState).toBe(QuestionState.BIDDING);

      // Player 2 disconnects (leaves the game)
      const leavingPlayerId = playerUsers[2].id;
      const autoBidPromise = suite.utils.waitForEventMatching<FinalBidSubmitOutputData>(
        showmanSocket,
        SocketIOGameEvents.FINAL_BID_SUBMIT,
        (data) => data.playerId === leavingPlayerId
      );

      playerSockets[2].emit(SocketIOGameEvents.LEAVE);
      await utils.disconnectAndCleanup(playerSockets[2]);

      // Wait for auto-bid of 1 for the leaving player
      const autoBidData = await autoBidPromise;
      expect(autoBidData).toEqual({
        playerId: leavingPlayerId,
        bidAmount: 1,
        isAutomatic: true
      });

      // Verify player was removed
      const gameAfterLeave = await utils.getGameFromGameService(gameId);
      expect(gameAfterLeave.hasPlayer(leavingPlayerId)).toBe(false);

      // Still in bidding phase (other players haven't bid yet)
      gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

      // Create a new socket for the same user (simulating reconnection)
      const { socket: reconnectedSocket } =
        await utils.createSocketForExistingUser(leavingPlayerId);

      // Player should be able to rejoin as PLAYER during final round
      // (because they were an existing player, not a new one)
      const joinPromise = utils.waitForEvent(reconnectedSocket, SocketIOGameEvents.GAME_DATA);

      reconnectedSocket.emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER
      });

      // Should successfully join and receive game data
      const gameData = await joinPromise;
      expect(gameData).toBeDefined();
      expect(gameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

      // Verify player is back in the game
      const gameAfterRejoin = await utils.getGameFromGameService(gameId);
      expect(gameAfterRejoin.hasPlayer(leavingPlayerId)).toBe(true);

      // Verify player's bid is preserved (bid=1 from auto-bid on leave)
      gameState = await utils.getGameState(gameId);
      expect(gameState.finalRoundData?.bids[leavingPlayerId]).toBe(1);
    });
  });
});
