import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { container } from "tsyringe";

import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { GameActionType } from "domain/enums/GameActionType";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  FinalAnswerSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData
} from "domain/types/socket/events/FinalRoundEventData";
import { GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

describe("Player Join Game State Tests", () => {
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

  describe("Player joining during Final Round phases", () => {
    it("restores the private final point to the rejoining showman only after the snapshot", async () => {
      await suite.scenario(async (scenario) => {
        const { gameId, showmanSocket, showmanUser, playerSockets, playerUsers, spectatorSockets } =
          await utils.setupFinalRoundGame({ playersCount: 2, playerScores: [1500, 1200] });
        const phase = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phase;

        const state = await utils.getGameState(gameId);
        const finalTheme = state.currentRound!.themes.find(
          (theme) => !theme.questions?.some((question) => question.isPlayed)
        )!;
        const questionId = finalTheme.questions![0].id;
        const store = container.resolve(PackageStore);
        const stored = await store.getQuestionWithTheme(gameId, questionId);
        expect(stored).not.toBeNull();
        const question: PackageQuestionDTO = {
          ...stored!.question,
          answerType: AnswerType.POINT,
          answerPoint: { x: 0.7, y: 0.3, imageAspectRatio: 2 },
          answerDeviation: 0.1,
          questionFiles: [
            {
              order: 0,
              displayTime: null,
              file: {
                md5: "point-image",
                type: PackageFileType.IMAGE,
                link: "https://example.test/point.png"
              }
            }
          ]
        };
        await container.resolve(RedisRepository).hset(store.getPackageKey(gameId), {
          [`q:${questionId}`]: JSON.stringify(question)
        });

        const firstBid = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_BID_SUBMIT);
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 800 });
        await firstBid;
        const finalQuestion = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, { bid: 600 });
        expect((await finalQuestion).questionData.question).toMatchObject({
          answerPoint: question.answerPoint
        });
        const firstAnswer = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.2,0.4" });
        await firstAnswer;
        const review = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.FINAL_SUBMIT_END);
        const accepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.FINAL_ANSWER_SUBMIT,
            socketId: playerSockets[1].id
          })
          .waitForCount(1);
        scenario
          .actor(playerSockets[1])
          .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, { answerText: "0.8,0.6" });
        await Promise.all([review, accepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        const reviewingState = await utils.getGameState(gameId);
        expect(reviewingState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);
        expect(reviewingState.currentQuestion?.id).toBeUndefined();

        await utils.disconnectAndCleanup(showmanSocket);
        const { socket: rejoinedHost } = await utils.createSocketForExistingUser(showmanUser.id);
        const hostJoinMark = scenario.mark();
        const hostJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: rejoinedHost.id
          })
          .waitForCount(1);
        const hostEvents = scenario.collectSocketEvents<
          GameJoinOutputData | FinalQuestionEventData
        >(rejoinedHost, [SocketIOGameEvents.GAME_DATA, SocketIOGameEvents.FINAL_QUESTION_DATA], 2);
        scenario
          .actor(rejoinedHost)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SHOWMAN });
        const [events] = await Promise.all([hostEvents.promise, hostJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        await scenario.assert.noInboundMany({
          actors: [...playerSockets, ...spectatorSockets].map((socket) => scenario.actor(socket)),
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: hostJoinMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });
        expect(events.map((entry) => entry.event)).toEqual([
          SocketIOGameEvents.GAME_DATA,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        ]);
        const snapshot = events[0].data as GameJoinOutputData;
        const restored = events[1].data as FinalQuestionEventData;
        expect(snapshot.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(snapshot.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        expect(restored.questionData.question).toMatchObject({
          id: questionId,
          answerPoint: question.answerPoint,
          answerDeviation: 0.1,
          questionFiles: question.questionFiles
        });

        await utils.disconnectAndCleanup(playerSockets[0]);
        const { socket: rejoinedPlayer } = await utils.createSocketForExistingUser(
          playerUsers[0].id
        );
        const playerActor = scenario.actor(rejoinedPlayer);
        const playerMark = scenario.mark();
        const playerJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: rejoinedPlayer.id
          })
          .waitForCount(1);
        const playerSnapshot = scenario.waitForEvent<GameJoinOutputData>(
          rejoinedPlayer,
          SocketIOGameEvents.GAME_DATA
        );
        scenario
          .actor(rejoinedPlayer)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.PLAYER });
        const [playerData] = await Promise.all([playerSnapshot, playerJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(playerData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(playerData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        await scenario.assert.noInbound({
          actor: playerActor,
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: playerMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });

        const { socket: spectator } = await utils.createGameClient();
        const spectatorActor = scenario.actor(spectator);
        const spectatorMark = scenario.mark();
        const spectatorJoinAccepted = scenario
          .createAcceptedActionProbe({
            gameId,
            actionType: GameActionType.JOIN,
            socketId: spectator.id
          })
          .waitForCount(1);
        const spectatorSnapshot = scenario.waitForEvent<GameJoinOutputData>(
          spectator,
          SocketIOGameEvents.GAME_DATA
        );
        scenario
          .actor(spectator)
          .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
        const [spectatorData] = await Promise.all([spectatorSnapshot, spectatorJoinAccepted]);
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(spectatorData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerPoint"
        );
        expect(spectatorData.gameState.finalRoundData?.questionData?.question).not.toHaveProperty(
          "answerDeviation"
        );
        await scenario.assert.noInbound({
          actor: spectatorActor,
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          afterSequence: spectatorMark,
          durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
        });

        await utils.disconnectAndCleanup(rejoinedHost);
        const { socket: missingHost } = await utils.createSocketForExistingUser(showmanUser.id);
        const missingResource = jest
          .spyOn(store, "getQuestionWithTheme")
          .mockResolvedValueOnce(null);
        try {
          const missingActor = scenario.actor(missingHost);
          const missingMark = scenario.mark();
          const missingJoinAccepted = scenario
            .createAcceptedActionProbe({
              gameId,
              actionType: GameActionType.JOIN,
              socketId: missingHost.id
            })
            .waitForCount(1);
          const snapshotWithoutResource = scenario.waitForEvent(
            missingHost,
            SocketIOGameEvents.GAME_DATA
          );
          scenario
            .actor(missingHost)
            .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SHOWMAN });
          await Promise.all([snapshotWithoutResource, missingJoinAccepted]);
          await scenario.assert.waitForActionsComplete({ gameId });
          await scenario.assert.noInbound({
            actor: missingActor,
            event: SocketIOGameEvents.FINAL_QUESTION_DATA,
            afterSequence: missingMark,
            durationMs: TEST_TIMEOUTS.SOCKET_NO_EVENT_WAIT_MS
          });
          expect(missingResource).toHaveBeenCalledWith(gameId, questionId);
        } finally {
          missingResource.mockRestore();
        }
      });
    });

    it("should receive questionData when joining during FINAL_ANSWERING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that a player joining during the final round answering phase
         * receives the question data in their game state.
         *
         * Flow:
         * 1. Set up game and progress to final round answering phase
         * 2. New player joins the game
         * 3. Verify the joined player receives questionData in gameState.finalRoundData
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);

        // Verify questionData is stored in game state
        expect(gameState.finalRoundData?.questionData).toBeDefined();
        expect(gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
        expect(gameState.finalRoundData?.questionData?.themeName).toBe(
          questionDataEvent.questionData.themeName
        );

        // Now create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        // Join as spectator (since game is in progress, can't join as player)
        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeName).toBe(
          questionDataEvent.questionData.themeName
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData?.question).toBeDefined();
      });
    });

    it("should hide submitted final answer text when a spectator joins during FINAL_ANSWERING phase", async () => {
      await suite.scenario(async (scenario) => {
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        await questionDataPromise;

        const submittedAnswer = "Private answer that must stay hidden";
        const submitPromise = scenario.waitForEvent<FinalAnswerSubmitOutputData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: submittedAnswer
        });

        const submitBroadcast = await submitPromise;
        expect(submitBroadcast).toEqual({ playerId: playerUsers[0].id });
        expect(submitBroadcast).not.toHaveProperty("answerText");

        const persistedState = await utils.getGameState(gameId);
        expect(persistedState.finalRoundData?.answers).toHaveLength(1);
        expect(persistedState.finalRoundData?.answers[0].answer).toBe(submittedAnswer);

        const { socket: lateSpectatorSocket } = await utils.createGameClient();

        const joinedGameData = await utils.joinGameWithData(
          lateSpectatorSocket,
          gameId,
          PlayerRole.SPECTATOR
        );
        const visibleAnswers = joinedGameData.gameState.finalRoundData?.answers;

        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.ANSWERING);
        expect(visibleAnswers).toHaveLength(1);
        expect(visibleAnswers?.[0].playerId).toBe(playerUsers[0].id);
        expect(visibleAnswers?.[0].answer).toBe("");
        expect(JSON.stringify(joinedGameData.gameState)).not.toContain(submittedAnswer);
      });
    });

    it("should receive questionData when joining during FINAL_REVIEWING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData persists and is accessible when joining
         * during the reviewing phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);

        // Submit answers to transition to reviewing phase
        const submitEndPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_SUBMIT_END
        );

        const firstAnswerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 1 answer"
        });
        await firstAnswerPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 2 answer"
        });
        await submitEndPromise;

        // Verify we're in reviewing phase
        gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.REVIEWING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);

        // questionData should still be present
        expect(gameState.finalRoundData?.questionData).toBeDefined();

        // Now create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        // Join as spectator
        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.REVIEWING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.REVIEWING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
      });
    });

    it("should NOT have questionData when joining during FINAL_BIDDING phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData is NOT present when joining during bidding phase
         * (before the question is revealed).
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination to transition to bidding phase
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Verify we're in bidding phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.BIDDING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

        // questionData should NOT be present yet
        expect(gameState.finalRoundData?.questionData).toBeUndefined();

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData (it's not revealed yet)
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.BIDDING);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          joinedGameData.gameState.currentRound?.themes.every(
            (theme) => theme.questions.length === 0
          )
        ).toBe(true);

        const stateAfterJoin = await utils.getGameState(gameId);
        expect(
          stateAfterJoin.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);
      });
    });

    it("should NOT have questionData when joining during FINAL_THEME_ELIMINATION phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that questionData is NOT present when joining during theme elimination phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { gameId } = setupResult;

        // Verify we're in theme elimination phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.THEME_ELIMINATION);

        // questionData should NOT be present
        expect(gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          gameState.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.THEME_ELIMINATION
        );
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeUndefined();
        expect(
          joinedGameData.gameState.currentRound?.themes.every(
            (theme) => theme.questions.length === 0
          )
        ).toBe(true);

        const stateAfterJoin = await utils.getGameState(gameId);
        expect(
          stateAfterJoin.currentRound?.themes.some((theme) => (theme.questions ?? []).length > 0)
        ).toBe(true);
      });
    });
  });

  describe("Player joining during paused game states", () => {
    it("should receive correct state when joining during paused answering phase", async () => {
      await suite.scenario(async (scenario) => {
        /**
         * Tests that a player joining during a paused game receives the correct state,
         * including the pause status and questionData if in answering phase.
         */
        const setupResult = await utils.setupFinalRoundGame({
          playersCount: 2,
          playerScores: [1500, 1200]
        });

        const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

        // Complete theme elimination
        const phaseTransitionPromise = scenario.waitForEvent<FinalPhaseCompleteEventData>(
          playerSockets[0],
          SocketIOGameEvents.FINAL_PHASE_COMPLETE
        );
        await utils.completeThemeElimination(playerSockets, gameId, playerUsers);
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = scenario.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800
        });
        await firstBidPromise;

        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.isPaused).toBe(false);

        // Pause the game
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(gameId);
        expect(gameState.isPaused).toBe(true);

        // Create a new player and have them join
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = scenario.waitForEvent<GameJoinOutputData>(
          newPlayerSocket,
          SocketIOGameEvents.GAME_DATA
        );

        scenario.actor(newPlayerSocket).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player sees the paused state
        expect(joinedGameData.gameState.isPaused).toBe(true);
        expect(joinedGameData.gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(joinedGameData.gameState.finalRoundData?.questionData).toBeDefined();
        expect(joinedGameData.gameState.finalRoundData?.questionData?.themeId).toBe(
          questionDataEvent.questionData.themeId
        );
      });
    });
  });
});
