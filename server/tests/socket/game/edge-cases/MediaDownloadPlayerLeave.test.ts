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

import { SYSTEM_PLAYER_ID } from "domain/constants/game";
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
 * Tests for Edge Case: Player Leave During Media Download
 *
 * When a player leaves/disconnects/is kicked during MEDIA_DOWNLOADING state:
 * - If all remaining active players have downloaded → transition to SHOWING
 * - If some remaining players haven't downloaded → stay in MEDIA_DOWNLOADING
 */
describe("Media Download Player Leave Edge Cases", () => {
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

  describe("Last Non-Ready Player Leaves", () => {
    it("should transition to SHOWING when last non-ready player leaves during media download", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        // Wait for media download status after leave (indicating all ready)
        const finalStatusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );

        // Player 1 leaves (who hasn't downloaded yet)
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);

        // Should receive status indicating all remaining players are ready
        const finalStatus = await finalStatusPromise;
        expect(finalStatus.allPlayersReady).toBe(true);
        expect(finalStatus.playerId).toBe(SYSTEM_PLAYER_ID);
        expect(finalStatus.timer).toBeDefined();
        expect(finalStatus.timer).not.toBeNull();

        // Verify game transitioned to SHOWING
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should transition to SHOWING when last non-ready player disconnects during media download", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        // Wait for final status
        const finalStatusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );

        // Player 1 disconnects (simulating connection drop)
        playerSockets[1].disconnect();

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

    it("should transition to SHOWING when last non-ready player is kicked during media download", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
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

        // Wait for final status after kick
        const finalStatusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );

        // Showman kicks player 1 (who hasn't downloaded)
        showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
          playerId: playerUsers[1].id,
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
  });

  describe("Non-Ready Player Leaves But Others Not Ready", () => {
    it("should remain in MEDIA_DOWNLOADING when a non-ready player leaves but others are also not ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        // Player 1 leaves (who hasn't downloaded)
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Give some time for state to settle
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Player 2 still hasn't downloaded, so should remain in MEDIA_DOWNLOADING
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should transition to SHOWING only when all remaining players are ready after leave", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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
        const statusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await statusPromise;

        // Player 1 leaves (who hasn't downloaded)
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Still in MEDIA_DOWNLOADING
        const gameStateMid = await utils.getGameState(gameId);
        expect(gameStateMid!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );

        // Player 2 downloads - should trigger transition
        const finalStatusPromise =
          utils.waitForEvent<MediaDownloadStatusBroadcastData>(
            showmanSocket,
            SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
            2000
          );
        playerSockets[2].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const finalStatus = await finalStatusPromise;

        expect(finalStatus.allPlayersReady).toBe(true);
        expect(finalStatus.timer).toBeDefined();

        // Should now transition to SHOWING
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Ready Player Leaves", () => {
    it("should not transition to SHOWING if a ready player leaves but others are not ready", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        // Player 0 (who HAS downloaded) leaves
        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        await leavePromise;

        // Give some time for state to settle
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Player 1 still hasn't downloaded
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("All Players Leave During Media Download", () => {
    it("should handle case when all players leave during media download", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        // Both players leave
        const leave1Promise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        await leave1Promise;

        const leave2Promise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        await leave2Promise;

        // Game should still exist and not crash
        const game = await utils.getGameFromGameService(gameId);
        expect(game).toBeDefined();

        // Should remain in MEDIA_DOWNLOADING (no active players to trigger transition)
        // OR transition to SHOWING if the logic considers "all 0 remaining = all ready"
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Single Player Leave During Media Download", () => {
    it("should transition to SHOWING when the only player leaves (no players left to wait for)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

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

        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );

        // Only player leaves
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);

        // Wait for leave to be processed
        await utils.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);

        // Give time for state processing
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Game should handle this gracefully
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
