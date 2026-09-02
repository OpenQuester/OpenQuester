import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  ThemeEliminateOutputData
} from "domain/types/socket/events/FinalRoundEventData";
import type { GameClientSocket } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TestUtils } from "tests/utils/TestUtils";

describe("Final Round Bidding Logic", () => {
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

  function waitForPlayerBroadcasts<T extends { playerId: number }>(
    socket: GameClientSocket,
    event: string,
    playerIds: readonly number[]
  ): Promise<T[]> {
    const broadcasts = Promise.all(
      playerIds.map((playerId) =>
        suite.currentScenario.waitForEventMatching<T>(
          socket,
          event,
          (data) => data.playerId === playerId
        )
      )
    );
    void broadcasts.catch(() => undefined);
    return broadcasts;
  }

  describe("Basic Bidding Flow", () => {
    it("should transition to bidding phase and start timer after theme elimination", async () => {
      await suite.scenario(async () => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200] // Both players have scores > 1
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
        const phaseTransitionPromise =
          suite.currentScenario.waitForEventMatching<FinalPhaseCompleteEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            (data) =>
              data.phase === FinalRoundPhase.THEME_ELIMINATION &&
              data.nextPhase === FinalRoundPhase.BIDDING
          );
        const playerPhaseTransitionPromise =
          suite.currentScenario.waitForEventMatching<FinalPhaseCompleteEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            (data) =>
              data.phase === FinalRoundPhase.THEME_ELIMINATION &&
              data.nextPhase === FinalRoundPhase.BIDDING
          );

        // Complete theme elimination to trigger bidding phase
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        const [phaseCompleteEvent, playerPhaseCompleteEvent] = await Promise.all([
          phaseTransitionPromise,
          playerPhaseTransitionPromise
        ]);
        expect(playerPhaseCompleteEvent).toEqual(phaseCompleteEvent);
        // Verify phase transition event was received
        expect(phaseCompleteEvent.phase).toBe(FinalRoundPhase.THEME_ELIMINATION);
        expect(phaseCompleteEvent.nextPhase).toBe(FinalRoundPhase.BIDDING);
        expect(phaseCompleteEvent.timer).toBeDefined();
        expect(phaseCompleteEvent.timer!.durationMs).toBe(45000); // 45 seconds
      });
    });

    it("should auto-eliminate the last theme on timer expiration and enter bidding", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1500, 1200, 1000]
        });

        const { showmanSocket, playerSockets, spectatorSockets, gameId } = setupResult;
        const spectatorSocket = spectatorSockets[0];

        let gameState = await utils.getGameState(gameId);
        let activeThemes =
          gameState.currentRound?.themes?.filter(
            (theme) => !theme.questions?.some((question) => question.isPlayed)
          ) ?? [];

        while (activeThemes.length > 2) {
          const [themeToEliminate] = activeThemes;
          const eliminationPromise = scenario.waitForEvent<ThemeEliminateOutputData>(
            showmanSocket,
            SocketIOGameEvents.THEME_ELIMINATE
          );

          scenario.actor(showmanSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
            themeId: themeToEliminate.id
          });
          await eliminationPromise;

          gameState = await utils.getGameState(gameId);
          activeThemes =
            gameState.currentRound?.themes?.filter(
              (theme) => !theme.questions?.some((question) => question.isPlayed)
            ) ?? [];
        }

        const remainingThemeIds = activeThemes.map((theme) => theme.id);
        const themeEliminatePromises = [
          scenario.waitForEvent<ThemeEliminateOutputData>(
            showmanSocket,
            SocketIOGameEvents.THEME_ELIMINATE
          ),
          scenario.waitForEvent<ThemeEliminateOutputData>(
            playerSockets[0],
            SocketIOGameEvents.THEME_ELIMINATE
          ),
          scenario.waitForEvent<ThemeEliminateOutputData>(
            spectatorSocket,
            SocketIOGameEvents.THEME_ELIMINATE
          )
        ];
        const phaseCompletePromises = [
          scenario.waitForEvent<FinalPhaseCompleteEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          ),
          scenario.waitForEvent<FinalPhaseCompleteEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          ),
          scenario.waitForEvent<FinalPhaseCompleteEventData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          )
        ];

        await utils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_THEME_ELIMINATION_EXPIRED
        );

        const timeoutEliminations = await Promise.all(themeEliminatePromises);
        const phaseCompletions = await Promise.all(phaseCompletePromises);

        for (const elimination of timeoutEliminations) {
          expect(remainingThemeIds).toContain(elimination.themeId);
          expect(elimination.eliminatedBy).toBe(SYSTEM_PLAYER_ID);
          expect(elimination.nextPlayerId).toBeNull();
        }

        for (const phaseComplete of phaseCompletions) {
          expect(phaseComplete.phase).toBe(FinalRoundPhase.THEME_ELIMINATION);
          expect(phaseComplete.nextPhase).toBe(FinalRoundPhase.BIDDING);
          expect(phaseComplete.timer).toBeDefined();
          expect(phaseComplete.timer!.durationMs).toBe(45000);
        }

        const finalGameState = await utils.getGameState(gameId);
        const eliminatedThemeIds = finalGameState.finalRoundData?.eliminatedThemes ?? [];
        const activeThemeIds = remainingThemeIds.filter(
          (themeId) => !eliminatedThemeIds.includes(themeId)
        );

        expect(finalGameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(finalGameState.questionState).toBe(QuestionState.BIDDING);
        expect(finalGameState.timer?.durationMs).toBe(45000);
        expect(activeThemeIds).toHaveLength(1);
      });
    });

    it("should automatically bid 1 for players with score <= 1", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 4,
          playerScores: [1500, 1, 0, -500] // One normal score, three low scores
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
        const automaticPlayerIds = playerUsers.slice(1).map((player) => player.id);
        const automaticBidEventsPromise = waitForPlayerBroadcasts<FinalBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          automaticPlayerIds
        );

        // Complete theme elimination and transition to bidding
        const phaseTransitionPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        await phaseTransitionPromise;
        const automaticBidEvents = await automaticBidEventsPromise;
        // Verify automatic bids were placed for players with score <= 1
        expect(automaticBidEvents).toEqual(
          automaticPlayerIds.map((playerId) => ({ playerId, bidAmount: 1, isAutomatic: true }))
        );

        // Verify game state shows the automatic bids
        const gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(Object.keys(gameState.finalRoundData?.bids || {})).toHaveLength(3);
      });
    });

    it("should transition to question phase when all remaining players submit bids", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1500, 1, 1200] // Two players need to bid manually, one auto-bids
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Set up promise to wait for question data before theme elimination
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        // Complete theme elimination and transition to bidding
        const phaseTransitionPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        await phaseTransitionPromise;

        // Submit bids from players who need to bid manually (players 0 and 2)
        // Wait for the first bid to be processed
        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBidPromise;

        // Submit second bid and wait for question data
        scenario.actor(playerSockets[2]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        const questionDataEvent = await questionDataPromise;

        // Verify transition to question phase
        expect(questionDataEvent.questionData).toBeDefined();
        expect(questionDataEvent.questionData.themeId).toBeDefined();
        expect(questionDataEvent.questionData.themeName).toBeDefined();
        expect(questionDataEvent.questionData.question).toBeDefined();

        // Verify game state
        const gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
      });
    });

    it("should broadcast timeout auto-bids before revealing final question", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1500, 1200, 1000]
        });

        const { showmanSocket, playerSockets, spectatorSockets, gameId, playerUsers } = setupResult;
        const spectatorSocket = spectatorSockets[0];
        const biddingPhasePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await biddingPhasePromise;

        const manualBidPromise = scenario.waitForEvent<FinalBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 700 });
        const manualBid = await manualBidPromise;
        expect(manualBid).toEqual({
          playerId: playerUsers[0].id,
          bidAmount: 700
        });

        const timeoutPlayerIds = [playerUsers[1].id, playerUsers[2].id];
        const showmanAutoBidsPromise = waitForPlayerBroadcasts<FinalBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          timeoutPlayerIds
        );
        const playerAutoBidsPromise = waitForPlayerBroadcasts<FinalBidSubmitOutputData>(
          playerSockets[1],
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          timeoutPlayerIds
        );
        const spectatorAutoBidsPromise = waitForPlayerBroadcasts<FinalBidSubmitOutputData>(
          spectatorSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          timeoutPlayerIds
        );

        const questionDataPromises = [
          scenario.waitForEvent<FinalQuestionEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          ),
          scenario.waitForEvent<FinalQuestionEventData>(
            playerSockets[1],
            SocketIOGameEvents.FINAL_QUESTION_DATA
          ),
          scenario.waitForEvent<FinalQuestionEventData>(
            spectatorSocket,
            SocketIOGameEvents.FINAL_QUESTION_DATA
          )
        ];
        const phaseCompletePromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );

        await utils.expireTimerAndWaitForAction(gameId, GameActionType.TIMER_BIDDING_EXPIRED);

        const questionEvents = await Promise.all(questionDataPromises);
        const phaseComplete = await phaseCompletePromise;
        const [showmanAutoBids, playerAutoBids, spectatorAutoBids] = await Promise.all([
          showmanAutoBidsPromise,
          playerAutoBidsPromise,
          spectatorAutoBidsPromise
        ]);

        const expectedTimeoutBids = [
          { playerId: playerUsers[1].id, bidAmount: 1, isAutomatic: true },
          { playerId: playerUsers[2].id, bidAmount: 1, isAutomatic: true }
        ];

        expect(showmanAutoBids).toEqual(expectedTimeoutBids);
        expect(playerAutoBids).toEqual(expectedTimeoutBids);
        expect(spectatorAutoBids).toEqual(expectedTimeoutBids);

        for (const questionEvent of questionEvents) {
          expect(questionEvent.questionData).toBeDefined();
          expect(questionEvent.questionData.question).toBeDefined();
        }

        expect(phaseComplete.phase).toBe(FinalRoundPhase.BIDDING);
        expect(phaseComplete.nextPhase).toBe(FinalRoundPhase.ANSWERING);
        expect(phaseComplete.timer).toBeDefined();

        const gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(gameState.finalRoundData?.bids[playerUsers[0].id]).toBe(700);
        expect(gameState.finalRoundData?.bids[playerUsers[1].id]).toBe(1);
        expect(gameState.finalRoundData?.bids[playerUsers[2].id]).toBe(1);
      });
    });

    it("should immediately transition to question phase when all players have score <= 1", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 3,
          playerScores: [1, 0, -100] // All players have low scores
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;
        const automaticPlayerIds = playerUsers.map((player) => player.id);
        const automaticBidEventsPromise = waitForPlayerBroadcasts<FinalBidSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          automaticPlayerIds
        );
        const biddingPhasePromise =
          suite.currentScenario.waitForEventMatching<FinalPhaseCompleteEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            (data) =>
              data.phase === FinalRoundPhase.THEME_ELIMINATION &&
              data.nextPhase === FinalRoundPhase.BIDDING
          );
        const answeringPhasePromise =
          suite.currentScenario.waitForEventMatching<FinalPhaseCompleteEventData>(
            showmanSocket,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            (data) =>
              data.phase === FinalRoundPhase.BIDDING && data.nextPhase === FinalRoundPhase.ANSWERING
          );

        // Set up promises to wait for all expected events
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        // Complete theme elimination and transition to bidding
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        // Wait for question data (which indicates all events have been emitted)
        const [questionDataEvent, automaticBidEvents, biddingPhase, answeringPhase] =
          await Promise.all([
            questionDataPromise,
            automaticBidEventsPromise,
            biddingPhasePromise,
            answeringPhasePromise
          ]);
        const phaseCompleteEvents = [biddingPhase, answeringPhase];

        // Verify all players auto-bid
        expect(automaticBidEvents).toEqual(
          automaticPlayerIds.map((playerId) => ({ playerId, bidAmount: 1, isAutomatic: true }))
        );

        // Verify both phase transitions occurred
        expect(phaseCompleteEvents).toHaveLength(2);
        expect(phaseCompleteEvents[0].phase).toBe(FinalRoundPhase.THEME_ELIMINATION);
        expect(phaseCompleteEvents[0].nextPhase).toBe(FinalRoundPhase.BIDDING);
        expect(phaseCompleteEvents[1].phase).toBe(FinalRoundPhase.BIDDING);
        expect(phaseCompleteEvents[1].nextPhase).toBe(FinalRoundPhase.ANSWERING);

        // Verify immediate transition to question phase
        expect(questionDataEvent.questionData).toBeDefined();

        // Verify game state
        const gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(Object.values(gameState.finalRoundData?.bids || {})).toEqual([1, 1, 1]);
      });
    });

    it("should allow showman to eliminate themes on behalf of current turn player", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200] // Both players have scores > 1
        });

        const { showmanSocket, playerSockets, gameId } = setupResult;

        // Get initial game state to find available themes
        const initialGameState = await utils.getGameState(gameId);
        const availableThemes = initialGameState.currentRound?.themes || [];
        expect(availableThemes.length).toBeGreaterThan(1);

        const showmanThemeEliminatePromise =
          suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
            showmanSocket,
            SocketIOGameEvents.THEME_ELIMINATE,
            (data) => data.themeId === availableThemes[0].id
          );
        const themeEliminatePromise =
          suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
            playerSockets[0],
            SocketIOGameEvents.THEME_ELIMINATE,
            (data) => data.themeId === availableThemes[0].id
          );
        // Showman eliminates first theme (acting on behalf of current turn player)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
          themeId: availableThemes[0].id
        });

        const [firstElimination] = await Promise.all([
          showmanThemeEliminatePromise,
          themeEliminatePromise
        ]);

        // Verify elimination event was received
        expect(firstElimination.themeId).toBe(availableThemes[0].id);
        expect(firstElimination.eliminatedBy).toBeDefined();
        expect(firstElimination.nextPlayerId).toBeDefined();

        const themeEliminatePromise2 =
          suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
            showmanSocket,
            SocketIOGameEvents.THEME_ELIMINATE,
            (data) => data.themeId === availableThemes[1].id
          );
        const playerThemeEliminatePromise2 =
          suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
            playerSockets[0],
            SocketIOGameEvents.THEME_ELIMINATE,
            (data) => data.themeId === availableThemes[1].id
          );

        // Showman eliminates second theme (acting on behalf of next turn player)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
          themeId: availableThemes[1].id
        });
        const [secondElimination, playerSecondElimination] = await Promise.all([
          themeEliminatePromise2,
          playerThemeEliminatePromise2
        ]);
        expect(playerSecondElimination).toEqual(secondElimination);

        // Verify second elimination event
        expect(secondElimination.themeId).toBe(availableThemes[1].id);

        // Continue eliminating until only one theme remains
        for (let i = 2; i < availableThemes.length - 1; i++) {
          const showmanThemeEliminatePromise =
            suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
              showmanSocket,
              SocketIOGameEvents.THEME_ELIMINATE,
              (data) => data.themeId === availableThemes[i].id
            );
          const playerThemeEliminatePromise =
            suite.currentScenario.waitForEventMatching<ThemeEliminateOutputData>(
              playerSockets[0],
              SocketIOGameEvents.THEME_ELIMINATE,
              (data) => data.themeId === availableThemes[i].id
            );

          scenario.actor(showmanSocket).emit(SocketIOGameEvents.THEME_ELIMINATE, {
            themeId: availableThemes[i].id
          });
          const [showmanElimination, playerElimination] = await Promise.all([
            showmanThemeEliminatePromise,
            playerThemeEliminatePromise
          ]);
          expect(playerElimination).toEqual(showmanElimination);
        }

        // Verify final state
        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

        // Verify only one theme remains (not eliminated)
        const eliminatedThemeIds = finalGameState.finalRoundData?.eliminatedThemes || [];
        const remainingThemes = availableThemes.filter((t) => !eliminatedThemeIds.includes(t.id));
        expect(remainingThemes).toHaveLength(1);
      });
    });
  });

  describe("Invalid Bidding Scenarios", () => {
    it("should reject a bid that is higher than the player's score", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 1,
          playerScores: [500]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        const phaseTransitionPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        await phaseTransitionPromise;

        // Player tries to bid more than they have
        const bidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 501 });
        await bidPromise;

        // Verify the bid was not accepted (should be normalized or rejected)
        const gameState = await utils.getGameState(gameId);
        // The bid should either not exist or be normalized to the player's max score
        const playerDBId = playerUsers[0].id;
        const actualBid = gameState.finalRoundData?.bids[playerDBId];
        expect(actualBid === undefined || actualBid <= 500).toBe(true);
      });
    });

    it("should reject a bid of zero or a negative number", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 1,
          playerScores: [500]
        });

        const { playerSockets, gameId, playerUsers } = setupResult;

        const phaseTransitionPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        await phaseTransitionPromise;

        const errorPromise = scenario.waitForEvent(playerSockets[0], SocketIOEvents.ERROR);

        // Player tries to bid zero
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 0 });

        await errorPromise;

        // Verify the bid was normalized to minimum (1) or rejected
        let gameState = await utils.getGameState(gameId);
        const playerDBId = playerUsers[0].id;
        let actualBid = gameState.finalRoundData?.bids[playerDBId];
        expect(actualBid === undefined || actualBid >= 1).toBe(true);

        // Player tries to bid a negative number
        const errorPromise2 = scenario.waitForEvent(playerSockets[0], SocketIOEvents.ERROR);

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: -100 });
        await errorPromise2;

        // Verify the bid was normalized to minimum (1) or rejected
        gameState = await utils.getGameState(gameId);
        actualBid = gameState.finalRoundData?.bids[playerDBId];
        expect(actualBid === undefined || actualBid >= 1).toBe(true);
      });
    });

    it("should not allow a player to bid twice", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 1,
          playerScores: [500]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        const phaseTransitionPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);

        await phaseTransitionPromise;

        // Player submits a valid bid
        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 100 });
        await firstBidPromise;

        // Verify the bid was accepted
        let gameState = await utils.getGameState(gameId);
        const playerDBId = playerUsers[0].id;
        expect(gameState.finalRoundData?.bids[playerDBId]).toBe(100);

        // Player tries to submit another bid
        const errorPromise = scenario.waitForEvent(playerSockets[0], SocketIOEvents.ERROR);

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 200 });
        await errorPromise;

        // Verify the bid was not changed (should remain 100)
        gameState = await utils.getGameState(gameId);
        expect(gameState.finalRoundData?.bids[playerDBId]).toBe(100);
      });
    });
  });
});
