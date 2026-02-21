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

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

describe("Edge Cases - Graceful Handling", () => {
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
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Multiple Unpause Requests", () => {
    it("should handle unpausing already unpaused game gracefully", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        // Start game - not paused
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial timer
        const initialGameState = await utils.getGameState(gameId);
        expect(initialGameState?.isPaused).toBe(false);
        expect(initialGameState?.timer).toBeDefined();

        // Unpause without prior pause (game is already unpaused)
        // This should succeed without error - the timer will be null because
        // there's no "paused" timer saved (paused timer uses different key)
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        // Timer is null because no paused timer was saved
        // This is expected behavior - the active timer continues normally
        expect(unpauseData.timer).toBeNull();

        // Verify game state remains unpaused and consistent
        const finalGameState = await utils.getGameState(gameId);
        expect(finalGameState?.isPaused).toBe(false);
        // The active timer in game state should still exist
        expect(finalGameState?.timer).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Disconnect During Answering", () => {
    it("should auto-handle answer as SKIP (0 points) when answering player disconnects", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 0 starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify answering player is set
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState?.answeringPlayer).toBe(playerUsers[0].id);

        // Record initial score
        const gameBefore = await utils.getGameFromGameService(gameId);
        const playerBefore = gameBefore.getPlayer(playerUsers[0].id, {
          fetchDisconnected: true,
        });
        const initialScore = playerBefore?.score ?? 0;

        // Set up listeners for auto-skip answer result BEFORE disconnecting
        const answerResultPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Disconnect the answering player - this should auto-skip their answer
        playerSockets[0].disconnect();

        // Wait for answer result event (auto-skip)
        const answerResult = await answerResultPromise;
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult).toBeDefined();
        expect(answerResult.answerResult.result).toBe(0); // SKIP = 0 points
        expect(answerResult.answerResult.answerType).toBe(
          AnswerResultType.SKIP
        );

        // Verify player is now disconnected
        const gameAfter = await utils.getGameFromGameService(gameId);
        const disconnectedPlayer = gameAfter.getPlayer(playerUsers[0].id, {
          fetchDisconnected: true,
        });
        expect(disconnectedPlayer?.gameStatus).toBe(
          PlayerGameStatus.DISCONNECTED
        );

        // Verify score is unchanged (SKIP = 0 points change)
        expect(disconnectedPlayer?.score).toBe(initialScore);

        // Verify game state is reset to SHOWING (question continues for other players)
        expect(gameAfter.gameState.questionState).toBe(QuestionState.SHOWING);
        expect(gameAfter.gameState.answeringPlayer).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Next Round Timer Clearing", () => {
    it("should clear active timer when progressing to next round", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0,
        true // include final round
      );
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Pick a question to create an active timer
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify timer is active
        const stateWithTimer = await utils.getGameState(gameId);
        expect(stateWithTimer?.timer).toBeDefined();
        expect(stateWithTimer?.questionState).toBe(QuestionState.SHOWING);

        // Progress to next round (skipping current round)
        const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
          showmanSocket,
          SocketIOGameEvents.NEXT_ROUND
        );

        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND);
        const nextRoundData = await nextRoundPromise;

        // Verify we're in next round
        expect(nextRoundData.gameState.currentRound?.type).toBe(
          PackageRoundType.FINAL
        );

        // Verify new state has no timer (or a fresh timer if final round needs one)
        expect(nextRoundData.gameState.timer).toBeNull();

        // Verify the old timer was cleared from Redis
        const game = await utils.getGameFromGameService(gameId);
        expect(game.gameState.timer).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Final Round Turn Order - Showman Fallback", () => {
    it("should use showman in turn order when no eligible players exist", async () => {
      // This test creates a game, starts it, has all players leave before final round,
      // then verifies showman gets turn order
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0,
        true // include final round
      );
      const { showmanSocket, playerSockets, gameId, showmanUser } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Player leaves the game
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        await utils.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);

        // Verify player left
        const gameAfterLeave = await utils.getGameFromGameService(gameId);
        const inGamePlayers = gameAfterLeave.getInGamePlayers();
        expect(inGamePlayers.length).toBe(0);

        // Progress to final round
        const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
          showmanSocket,
          SocketIOGameEvents.NEXT_ROUND
        );

        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND);
        const nextRoundData = await nextRoundPromise;

        // Verify we're in final round
        expect(nextRoundData.gameState.currentRound?.type).toBe(
          PackageRoundType.FINAL
        );

        // Verify showman is in turn order (fallback when no players)
        const finalRoundData = nextRoundData.gameState.finalRoundData;
        expect(finalRoundData).toBeDefined();
        expect(finalRoundData!.turnOrder).toBeDefined();
        expect(finalRoundData!.turnOrder.length).toBe(1);
        expect(finalRoundData!.turnOrder[0]).toBe(showmanUser.id);

        // Verify current turn player is showman
        expect(nextRoundData.gameState.currentTurnPlayerId).toBe(
          showmanUser.id
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should use single player in turn order when only one player exists", async () => {
      const setup = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0,
        true
      );
      const { showmanSocket, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Progress to final round with single player
        const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
          showmanSocket,
          SocketIOGameEvents.NEXT_ROUND
        );

        showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND);
        const nextRoundData = await nextRoundPromise;

        // Verify final round with single player in turn order
        const finalRoundData = nextRoundData.gameState.finalRoundData;
        expect(finalRoundData!.turnOrder.length).toBe(1);
        expect(finalRoundData!.turnOrder[0]).toBe(playerUsers[0].id);
        expect(nextRoundData.gameState.currentTurnPlayerId).toBe(
          playerUsers[0].id
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Player Disconnect During Pause", () => {
    it("should handle player disconnect while game is paused", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Pause the game
        await utils.pauseGame(showmanSocket);

        // Verify game is paused
        const pausedState = await utils.getGameState(gameId);
        expect(pausedState?.isPaused).toBe(true);

        // Player 0 disconnects while paused
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].disconnect();
        await leavePromise;

        // Game should still be paused
        const stateAfterDisconnect = await utils.getGameState(gameId);
        expect(stateAfterDisconnect?.isPaused).toBe(true);

        // Unpause should still work
        const unpausePromise = utils.waitForEvent(
          playerSockets[1],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // Game continues without the disconnected player
        const resumedState = await utils.getGameState(gameId);
        expect(resumedState?.isPaused).toBe(false);

        // Verify remaining player can still play
        const game = await utils.getGameFromGameService(gameId);
        const inGamePlayers = game.getInGamePlayers();
        expect(inGamePlayers.length).toBe(1);
        expect(inGamePlayers[0].meta.id).toBe(playerUsers[1].id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
