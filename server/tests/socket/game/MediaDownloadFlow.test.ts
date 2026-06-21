import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { RedisConfig } from "shared/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "shared/logging/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import {
  type GameClientSocket,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { TestUtils } from "tests/utils/TestUtils";

async function pickQuestionAndExpectMediaData(
  utils: SocketGameTestUtils,
  pickerSocket: GameClientSocket,
  observerSocket: GameClientSocket,
  questionId: number
): Promise<GameQuestionDataEventPayload> {
  const questionDataPromise = utils.waitForEvent<GameQuestionDataEventPayload>(
    observerSocket,
    SocketIOGameEvents.QUESTION_DATA
  );

  pickerSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

  const questionData = await questionDataPromise;

  expect(questionData.data.id).toBe(questionId);
  expect(questionData.data.questionFiles).not.toHaveLength(0);
  expect(questionData.timer).toBeDefined();

  return questionData;
}

async function pickQuestionWithoutFilesAndExpectImmediateReveal(
  utils: SocketGameTestUtils,
  pickerSocket: GameClientSocket,
  observerSocket: GameClientSocket,
  questionId: number
): Promise<GameQuestionDataEventPayload> {
  const revealPromise = utils.waitForEvent<GameQuestionDataEventPayload>(
    observerSocket,
    SocketIOGameEvents.QUESTION_DATA
  );

  pickerSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

  const reveal = await revealPromise;

  expect(reveal.data.id).toBe(questionId);
  expect(reveal.data.questionFiles ?? []).toEqual([]);
  expect(reveal.timer).toBeDefined();

  return reveal;
}

function waitForQuestionReveal(
  utils: SocketGameTestUtils,
  socket: GameClientSocket
): Promise<void> {
  return utils.waitForNoEvent(socket, SocketIOGameEvents.QUESTION_DATA);
}

describe("Media Download Flow Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let testUtils: TestUtils;
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
    testUtils = new TestUtils(app, userRepo, serverUrl);
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

  describe("Single Player Media Download", () => {
    it("should emit empty question-pick before immediate reveal when question has no files", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        await utils.startGame(showmanSocket);

        const questionId = await utils.getQuestionIdByType(gameId, PackageQuestionType.NO_RISK);

        const reveal = await pickQuestionWithoutFilesAndExpectImmediateReveal(
          utils,
          showmanSocket,
          playerSocket,
          questionId
        );

        expect(reveal.data.id).toBe(questionId);

        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should transition to SHOWING state when single player downloads media", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        await utils.startGame(showmanSocket);

        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSocket, questionId);

        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const mediaDownloadStatusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSocket);
        playerSocket.emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

        const statusData = await mediaDownloadStatusPromise;
        await questionDataPromise;

        expect(statusData.mediaDownloaded).toBe(true);
        expect(statusData.allPlayersReady).toBe(true);
        expect(statusData.timer).toBeDefined();
        expect(statusData.timer).not.toBeNull();

        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should use MEDIA_DOWNLOADING state before transition", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;
      const playerSocket = playerSockets[0];

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSocket, questionId);

        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Multiple Players Media Download", () => {
    it("should wait for all players to download before transitioning to SHOWING", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status1 = await status1Promise;

        expect(status1.allPlayersReady).toBe(false);
        expect(status1.timer).toBeNull();

        let gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const status2Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[1],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[1].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status2 = await status2Promise;

        expect(status2.allPlayersReady).toBe(false);
        expect(status2.timer).toBeNull();

        gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const status3Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[2],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);
        playerSockets[2].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status3 = await status3Promise;
        await questionDataPromise;

        expect(status3.allPlayersReady).toBe(true);
        expect(status3.timer).toBeDefined();
        expect(status3.timer).not.toBeNull();

        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should broadcast status updates to all clients when each player downloads", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const showmanStatusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const player2StatusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[1],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );

        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

        const [showmanStatus, player2Status] = await Promise.all([
          showmanStatusPromise,
          player2StatusPromise
        ]);

        expect(showmanStatus.allPlayersReady).toBe(false);
        expect(player2Status.allPlayersReady).toBe(false);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle out-of-order download confirmations correctly", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const status3Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[2].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status3Promise;

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status1Promise;

        const statusFinalPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);
        playerSockets[1].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const statusFinal = await statusFinalPromise;
        await questionDataPromise;

        expect(statusFinal.allPlayersReady).toBe(true);
        expect(statusFinal.timer).toBeDefined();

        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Media Download Timeout", () => {
    /**
     * Note: This test verifies timer-based media download timeout behavior.
     * It may occasionally fail in full suite runs due to Redis keyspace notification
     * timing issues. The test validates that:
     * 1. Timer expiration triggers forceAllPlayersReady
     * 2. MEDIA_DOWNLOAD_STATUS event is broadcast with allPlayersReady=true
     * 3. State transitions to SHOWING (verified via waitForCondition)
     */
    it("should force all players ready and transition to SHOWING on timeout", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const statusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);

        await testUtils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
        );

        const statusData = await statusPromise;
        await questionDataPromise;

        expect(statusData.allPlayersReady).toBe(true);
        expect(statusData.playerId).toBe(-1);
        expect(statusData.timer).toBeDefined();
        expect(statusData.timer).not.toBeNull();

        // Wait for state to transition to SHOWING
        // The state should transition after the MEDIA_DOWNLOAD_STATUS event is received
        // Allow extra time for Redis state propagation
        const stateTransitioned = await testUtils.waitForCondition(async () => {
          const state = await utils.getGameState(gameId);
          return state!.questionState === QuestionState.SHOWING;
        });
        expect(stateTransitioned).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle timeout when some players downloaded and others did not", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status1Promise;

        const timeoutStatusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);

        await testUtils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED
        );

        const timeoutStatus = await timeoutStatusPromise;
        await questionDataPromise;

        expect(timeoutStatus.allPlayersReady).toBe(true);
        expect(timeoutStatus.playerId).toBe(-1);
        expect(timeoutStatus.timer).toBeDefined();

        // Wait for state to transition to SHOWING
        // The state should transition after the MEDIA_DOWNLOAD_STATUS event is received
        // Allow extra time for Redis state propagation
        const stateTransitioned = await testUtils.waitForCondition(async () => {
          const state = await utils.getGameState(gameId);
          return state!.questionState === QuestionState.SHOWING;
        });
        expect(stateTransitioned).toBe(true);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not send timeout event if all players downloaded before timeout", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status1Promise;

        const status2Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);
        playerSockets[1].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status2 = await status2Promise;
        await questionDataPromise;

        expect(status2.allPlayersReady).toBe(true);
        expect(status2.playerId).not.toBe(-1);

        const redisClient = RedisConfig.getClient();
        const timerKey = `timer:${gameId}`;
        const ttl = await redisClient.pttl(timerKey);
        expect(ttl).toBeGreaterThan(0);

        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should send question data to player joining during media download without exposing it in game data", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;
      let lateSocket: GameClientSocket | undefined;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const lateClient = await utils.createGameClient(app, userRepo);
        lateSocket = lateClient.socket;
        const questionDataPromise = utils.waitForEvent<GameQuestionDataEventPayload>(
          lateSocket,
          SocketIOGameEvents.QUESTION_DATA
        );

        const joinedGameData = await utils.joinSpecificGameWithData(
          lateSocket,
          gameId,
          PlayerRole.PLAYER
        );

        const questionData = await questionDataPromise;
        expect(joinedGameData.gameState.currentQuestion).toBeNull();
        expect(questionData.data.id).toBe(questionId);
        expect(questionData.data.questionFiles).not.toHaveLength(0);
      } finally {
        if (lateSocket) {
          await utils.disconnectAndCleanup(lateSocket);
        }
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle duplicate MEDIA_DOWNLOADED events from same player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status1 = await status1Promise;

        expect(status1.allPlayersReady).toBe(false);

        const status2Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status2 = await status2Promise;

        expect(status2.allPlayersReady).toBe(false);
        expect(status2.playerId).toBe(status1.playerId);

        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should not process MEDIA_DOWNLOADED when not in MEDIA_DOWNLOADING state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);

        const gameStateBefore = await utils.getGameState(gameId);
        expect(gameStateBefore!.questionState).toBe(QuestionState.CHOOSING);

        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle spectators not affecting media download state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 1, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const statusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);

        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);

        const status = await statusPromise;
        await questionDataPromise;

        expect(status.allPlayersReady).toBe(true);
        expect(status.timer).toBeDefined();

        const gameState = await utils.getGameState(gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Timer Integration", () => {
    it("should start question timer only after all players downloaded media", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const gameStateDownloading = await utils.getGameState(gameId);
        expect(gameStateDownloading!.timer).toBeDefined();
        expect(gameStateDownloading!.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);

        const status1Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        await status1Promise;

        const status2Promise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);
        playerSockets[1].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status2 = await status2Promise;
        await questionDataPromise;

        expect(status2.timer).toBeDefined();
        expect(status2.allPlayersReady).toBe(true);

        const gameStateShowing = await utils.getGameState(gameId);
        expect(gameStateShowing!.timer).toBeDefined();
        expect(gameStateShowing!.questionState).toBe(QuestionState.SHOWING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should have different timer durations for MEDIA_DOWNLOADING and SHOWING", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, {
        includeMediaQuestionFiles: true
      });
      const { showmanSocket, playerSockets, gameId } = setup;

      try {
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        await pickQuestionAndExpectMediaData(utils, showmanSocket, playerSockets[0], questionId);

        const gameStateDownloading = await utils.getGameState(gameId);
        const downloadingTimerDuration = gameStateDownloading!.timer?.durationMs;

        const statusPromise = utils.waitForEvent<MediaDownloadStatusBroadcastData>(
          playerSockets[0],
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS
        );
        const questionDataPromise = waitForQuestionReveal(utils, playerSockets[0]);
        playerSockets[0].emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const status = await statusPromise;
        await questionDataPromise;

        const showingTimerDuration = status.timer?.durationMs;

        expect(downloadingTimerDuration).toBeDefined();
        expect(showingTimerDuration).toBeDefined();
        expect(downloadingTimerDuration).not.toBe(showingTimerDuration);
        expect(downloadingTimerDuration).toBeLessThan(showingTimerDuration!);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
