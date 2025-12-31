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
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { TestUtils } from "tests/utils/TestUtils";

describe("Player Join Game State Tests", () => {
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
    if (cleanup) {
      await cleanup();
    }
    await testEnv.teardown();
  });

  describe("Player joining during Final Round phases", () => {
    it("should receive questionData when joining during FINAL_ANSWERING phase", async () => {
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
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      try {
        // Complete theme elimination
        const phaseTransitionPromise =
          utils.waitForEvent<FinalPhaseCompleteEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = utils.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        });
        await firstBidPromise;

        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
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
        const joinGamePromise = new Promise<GameJoinOutputData>((resolve) => {
          newPlayerSocket.once(
            SocketIOGameEvents.GAME_DATA,
            (data: GameJoinOutputData) => {
              resolve(data);
            }
          );
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(
          QuestionState.ANSWERING
        );
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.ANSWERING
        );
        expect(
          joinedGameData.gameState.finalRoundData?.questionData
        ).toBeDefined();
        expect(
          joinedGameData.gameState.finalRoundData?.questionData?.themeId
        ).toBe(questionDataEvent.questionData.themeId);
        expect(
          joinedGameData.gameState.finalRoundData?.questionData?.themeName
        ).toBe(questionDataEvent.questionData.themeName);
        expect(
          joinedGameData.gameState.finalRoundData?.questionData?.question
        ).toBeDefined();

        // Cleanup
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        showmanSocket.disconnect();
        playerSockets.forEach((socket) => socket.disconnect());
        setupResult.spectatorSockets[0].disconnect();
      }
    });

    it("should receive questionData when joining during FINAL_REVIEWING phase", async () => {
      /**
       * Tests that questionData persists and is accessible when joining
       * during the reviewing phase.
       */
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      try {
        // Complete theme elimination
        const phaseTransitionPromise =
          utils.waitForEvent<FinalPhaseCompleteEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = utils.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        });
        await firstBidPromise;

        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);

        // Submit answers to transition to reviewing phase
        const submitEndPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_SUBMIT_END
        );

        const firstAnswerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_ANSWER_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 1 answer",
        });
        await firstAnswerPromise;

        playerSockets[1].emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          answerText: "Player 2 answer",
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
        const joinGamePromise = new Promise<GameJoinOutputData>((resolve) => {
          newPlayerSocket.once(
            SocketIOGameEvents.GAME_DATA,
            (data: GameJoinOutputData) => {
              resolve(data);
            }
          );
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player receives questionData
        expect(joinedGameData.gameState.questionState).toBe(
          QuestionState.REVIEWING
        );
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.REVIEWING
        );
        expect(
          joinedGameData.gameState.finalRoundData?.questionData
        ).toBeDefined();
        expect(
          joinedGameData.gameState.finalRoundData?.questionData?.themeId
        ).toBe(questionDataEvent.questionData.themeId);

        // Cleanup
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        showmanSocket.disconnect();
        playerSockets.forEach((socket) => socket.disconnect());
        setupResult.spectatorSockets[0].disconnect();
      }
    });

    it("should NOT have questionData when joining during FINAL_BIDDING phase", async () => {
      /**
       * Tests that questionData is NOT present when joining during bidding phase
       * (before the question is revealed).
       */
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      try {
        // Complete theme elimination to transition to bidding phase
        const phaseTransitionPromise =
          utils.waitForEvent<FinalPhaseCompleteEventData>(
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
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.BIDDING);
        expect(gameState.finalRoundData?.phase).toBe(FinalRoundPhase.BIDDING);

        // questionData should NOT be present yet
        expect(gameState.finalRoundData?.questionData).toBeUndefined();

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = new Promise<GameJoinOutputData>((resolve) => {
          newPlayerSocket.once(
            SocketIOGameEvents.GAME_DATA,
            (data: GameJoinOutputData) => {
              resolve(data);
            }
          );
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData (it's not revealed yet)
        expect(joinedGameData.gameState.questionState).toBe(
          QuestionState.BIDDING
        );
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.BIDDING
        );
        expect(
          joinedGameData.gameState.finalRoundData?.questionData
        ).toBeUndefined();

        // Cleanup
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        showmanSocket.disconnect();
        playerSockets.forEach((socket) => socket.disconnect());
        setupResult.spectatorSockets[0].disconnect();
      }
    });

    it("should NOT have questionData when joining during FINAL_THEME_ELIMINATION phase", async () => {
      /**
       * Tests that questionData is NOT present when joining during theme elimination phase.
       */
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId } = setupResult;

      try {
        // Verify we're in theme elimination phase
        const gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.THEME_ELIMINATION);
        expect(gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.THEME_ELIMINATION
        );

        // questionData should NOT be present
        expect(gameState.finalRoundData?.questionData).toBeUndefined();

        // Create a new player and have them join the game
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = new Promise<GameJoinOutputData>((resolve) => {
          newPlayerSocket.once(
            SocketIOGameEvents.GAME_DATA,
            (data: GameJoinOutputData) => {
              resolve(data);
            }
          );
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player does NOT receive questionData
        expect(joinedGameData.gameState.questionState).toBe(
          QuestionState.THEME_ELIMINATION
        );
        expect(joinedGameData.gameState.finalRoundData?.phase).toBe(
          FinalRoundPhase.THEME_ELIMINATION
        );
        expect(
          joinedGameData.gameState.finalRoundData?.questionData
        ).toBeUndefined();

        // Cleanup
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        showmanSocket.disconnect();
        playerSockets.forEach((socket) => socket.disconnect());
        setupResult.spectatorSockets[0].disconnect();
      }
    });
  });

  describe("Player joining during paused game states", () => {
    it("should receive correct state when joining during paused answering phase", async () => {
      /**
       * Tests that a player joining during a paused game receives the correct state,
       * including the pause status and questionData if in answering phase.
       */
      const setupResult = await utils.setupFinalRoundGame({
        playersCount: 2,
        playerScores: [1500, 1200],
      });

      const { showmanSocket, playerSockets, gameId, playerUsers } = setupResult;

      try {
        // Complete theme elimination
        const phaseTransitionPromise =
          utils.waitForEvent<FinalPhaseCompleteEventData>(
            playerSockets[0],
            SocketIOGameEvents.FINAL_PHASE_COMPLETE
          );
        await utils.completeThemeElimination(
          playerSockets,
          gameId,
          playerUsers
        );
        await phaseTransitionPromise;

        // Submit bids to transition to answering phase
        const questionDataPromise = utils.waitForEvent<FinalQuestionEventData>(
          showmanSocket,
          SocketIOGameEvents.FINAL_QUESTION_DATA
        );

        const firstBidPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.FINAL_BID_SUBMIT
        );
        playerSockets[0].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 800,
        });
        await firstBidPromise;

        playerSockets[1].emit(SocketIOGameEvents.FINAL_BID_SUBMIT, {
          bid: 600,
        });
        const questionDataEvent = await questionDataPromise;

        // Verify we're in answering phase
        let gameState = await utils.getGameState(gameId);
        expect(gameState.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState.isPaused).toBe(false);

        // Pause the game
        const pausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE);
        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(gameId);
        expect(gameState.isPaused).toBe(true);

        // Create a new player and have them join
        const { socket: newPlayerSocket } = await utils.createGameClient();

        const joinGamePromise = new Promise<GameJoinOutputData>((resolve) => {
          newPlayerSocket.once(
            SocketIOGameEvents.GAME_DATA,
            (data: GameJoinOutputData) => {
              resolve(data);
            }
          );
        });

        newPlayerSocket.emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.SPECTATOR,
        });

        const joinedGameData = await joinGamePromise;

        // Verify the joined player sees the paused state
        expect(joinedGameData.gameState.isPaused).toBe(true);
        expect(joinedGameData.gameState.questionState).toBe(
          QuestionState.ANSWERING
        );
        expect(
          joinedGameData.gameState.finalRoundData?.questionData
        ).toBeDefined();
        expect(
          joinedGameData.gameState.finalRoundData?.questionData?.themeId
        ).toBe(questionDataEvent.questionData.themeId);

        // Cleanup
        await utils.disconnectAndCleanup(newPlayerSocket);
      } finally {
        showmanSocket.disconnect();
        playerSockets.forEach((socket) => socket.disconnect());
        setupResult.spectatorSockets[0].disconnect();
      }
    });
  });
});
