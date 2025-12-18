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
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * Tests for Edge Case 1: Restrict during their turn
 *
 * When a player is restricted to spectator during active game states,
 * the game state should be cleaned up (similar to player leave):
 * - Answering player restricted → 0 points, return to SHOWING
 * - Turn player restricted → currentTurnPlayerId cleared
 * - Bidding player restricted → move to next bidder or end bidding
 * - Media downloading player restricted → check if remaining are ready
 */
describe("Player Restriction State Cleanup Edge Cases", () => {
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
    try {
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Restriction During Answering", () => {
    it("should auto-skip answer with 0 points when answering player is restricted", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 0 starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);

        // Get answering player's score before restriction
        const gameBefore = await utils.getGameFromGameService(gameId);
        const answeringPlayerBefore = gameBefore.getPlayer(playerUsers[0].id, {
          fetchDisconnected: false,
        });
        const scoreBefore = answeringPlayerBefore!.score;

        // Set up listener for answer result
        const answerResultPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Showman restricts the answering player
        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[0].id,
          muted: false,
          restricted: true,
          banned: false,
        });

        // Should receive automatic answer result with 0 points
        const answerResultData = await answerResultPromise;
        expect(answerResultData).toBeDefined();
        expect(answerResultData.answerResult).toBeDefined();
        expect(answerResultData.answerResult.player).toBe(playerUsers[0].id);
        expect(answerResultData.answerResult.result).toBe(0);

        // Verify answeringPlayer is cleared
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.answeringPlayer).toBeNull();
        expect(gameStateAfter!.questionState).not.toBe(QuestionState.ANSWERING);

        // Verify score is unchanged (0 points for skip)
        const gameAfter = await utils.getGameFromGameService(gameId);
        const restrictedPlayer = gameAfter.getPlayer(playerUsers[0].id, {
          fetchDisconnected: false,
        });
        expect(restrictedPlayer).toBeDefined();
        expect(restrictedPlayer!.score).toBe(scoreBefore);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should allow other players to answer after answering player is restricted", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 0 starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);

        // Wait for auto-skip answer result
        const answerResultPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Restrict the answering player
        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[0].id,
          muted: false,
          restricted: true,
          banned: false,
        });

        await answerResultPromise;

        // Verify game returned to SHOWING state
        const stateAfterRestriction = await utils.getGameState(gameId);
        expect(stateAfterRestriction!.questionState).toBe(
          QuestionState.SHOWING
        );
        expect(stateAfterRestriction!.answeringPlayer).toBeNull();

        // Player 1 should be able to answer
        const answerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        playerSockets[1].emit(SocketIOGameEvents.QUESTION_ANSWER);
        await answerPromise;

        const answeringState2 = await utils.getGameState(gameId);
        expect(answeringState2!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState2!.answeringPlayer).toBe(playerUsers[1].id);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Restriction During Turn", () => {
    it("should clear currentTurnPlayerId when turn player is restricted during question selection", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Get current game state to identify turn player
        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.currentTurnPlayerId).toBeDefined();
        const turnPlayerId = gameStateBefore!.currentTurnPlayerId!;

        // Find the socket for the turn player
        const turnPlayerIndex = playerUsers.findIndex(
          (u) => u.id === turnPlayerId
        );
        expect(turnPlayerIndex).toBeGreaterThanOrEqual(0);

        // Wait for both PLAYER_RESTRICTED and TURN_PLAYER_CHANGED events
        const restrictionPromise = utils.waitForEvent(
          playerSockets[1 - turnPlayerIndex],
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        // Restrict the turn player
        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: turnPlayerId,
          muted: false,
          restricted: true,
          banned: false,
        });

        await restrictionPromise;

        // Verify currentTurnPlayerId is cleared
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not crash when turn player is restricted and only one active player remains", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);

        const gameStateBefore = await utils.getGameState(gameId);
        const turnPlayerId = gameStateBefore!.currentTurnPlayerId!;

        // Restrict the turn player
        const restrictionPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: turnPlayerId,
          muted: false,
          restricted: true,
          banned: false,
        });

        await restrictionPromise;

        // Game should still be operational with only one active player
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter).toBeDefined();
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();

        // Verify showman can assign turn to remaining player
        const otherPlayerId = playerUsers.find(
          (u) => u.id !== turnPlayerId
        )!.id;
        await utils.setCurrentTurnPlayer(showmanSocket, otherPlayerId);

        const gameStateWithTurn = await utils.getGameState(gameId);
        expect(gameStateWithTurn!.currentTurnPlayerId).toBe(otherPlayerId);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Restriction During Media Download", () => {
    it("should transition to SHOWING when restricting the last non-ready player during media download", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        // Pick question to trigger MEDIA_DOWNLOADING state
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        await utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA,
          2000
        );

        const mediaDownloadState = await utils.getGameState(gameId);
        expect(mediaDownloadState!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );

        // Player 0 downloads media
        const status1Promise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            playerSockets[1],
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status1 = await status1Promise;
        expect(status1.allPlayersReady).toBe(false);

        // Set up listener for final status (should come after restriction)
        const finalStatusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );

        // Restrict player 1 (who hasn't downloaded yet)
        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[1].id,
          muted: false,
          restricted: true,
          banned: false,
        });

        // Should receive status indicating all remaining players are ready
        const finalStatus = await finalStatusPromise;
        expect(finalStatus.allPlayersReady).toBe(true);
        expect(finalStatus.timer).toBeDefined();

        // Verify game transitioned to SHOWING
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should NOT transition when restricting a player but other players still not ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        // Pick question
        showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

        await utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA,
          2000
        );

        // Player 0 downloads media
        const status1Promise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status1Promise;

        // Restrict player 1 (who hasn't downloaded)
        const restrictionPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        showmanSocket.emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[1].id,
          muted: false,
          restricted: true,
          banned: false,
        });

        await restrictionPromise;

        // Player 2 still hasn't downloaded, so should remain in MEDIA_DOWNLOADING
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
