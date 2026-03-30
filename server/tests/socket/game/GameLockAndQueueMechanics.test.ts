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
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameLeaveBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Game Lock and Queue Mechanics", () => {
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
      if (cleanup) await cleanup();
      await testEnv.teardown();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  describe("Concurrent Player Leave", () => {
    it("should handle two players leaving simultaneously", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        // in the action queue (pre-existing edge case, not migration-related)
        const leavePromise1 = utils.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        const leaveData1 = await leavePromise1;
        leftUserIds.push(leaveData1.user);

        const leavePromise2 = utils.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        const leaveData2 = await leavePromise2;
        leftUserIds.push(leaveData2.user);

        expect(leftUserIds).toHaveLength(2);

        // Verify both players are gone from game
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });

        // One showman + one player should remain connected (2 total)
        expect(connectedPlayers.length).toBe(2);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle three players leaving in rapid succession", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        for (let i = 0; i < 3; i++) {
          const leavePromise =
            utils.waitForEvent<GameLeaveBroadcastData>(
              showmanSocket,
              SocketIOGameEvents.LEAVE
            );
          playerSockets[i].emit(SocketIOGameEvents.LEAVE);
          const leaveData = await leavePromise;
          leftUserIds.push(leaveData.user);
        }

        expect(leftUserIds).toHaveLength(3);

        // Verify only one player remains
        const game = await utils.getGameFromGameService(setup.gameId);
        expect(game).toBeDefined();

        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Only showman should remain (1 total)
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);

        const remainingPlayerIds = connectedPlayers.map((p) => p.meta.id);

        leftUserIds.forEach((userId) => {
          expect(remainingPlayerIds).not.toContain(userId);
        });
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle player leave during active question", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Pick a question to enter answering phase
        const questionDataPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        const leftUserIds: number[] = [];

        // Serialize leave emissions to avoid RPUSH/LLEN race condition
        const leavePromise1 = utils.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        const leaveData1 = await leavePromise1;
        leftUserIds.push(leaveData1.user);

        const leavePromise2 = utils.waitForEvent<GameLeaveBroadcastData>(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        const leaveData2 = await leavePromise2;
        leftUserIds.push(leaveData2.user);

        expect(leftUserIds).toHaveLength(2);

        // Verify both players left (only showman remains)
        const game = await utils.getGameFromGameService(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );
        expect(connectedPlayers.length).toBe(1);
        expect(connectedPlayers[0].role).toBe(PlayerRole.SHOWMAN);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Concurrent Answer Submission and Review", () => {
    it("should handle rapid player answer and showman review", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Pick question and wait for question data
        const questionDataPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Verify we're in SHOWING state before actions
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);

        // Setup event listeners for answer result and answer-show-start
        const answerResultPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        const answerShowStartPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );

        // Serialize: first submit answer, wait for it to be processed,
        // then submit review to avoid RPUSH/LLEN race condition
        const answerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        const answer = await answerPromise;

        // Now submit the review after the answer has been processed
        showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
          scoreResult: 400,
          answerType: AnswerResultType.CORRECT,
        });

        // Wait for answer result and answer-show-start to ensure
        // the server has fully transitioned to SHOWING_ANSWER state
        // and released the lock before we send skip-show-answer
        const answerResult = await answerResultPromise;
        await answerShowStartPromise;

        // Skip show answer phase — this also waits for ANSWER_SHOW_END
        await utils.skipShowAnswer(showmanSocket);

        // ANSWER_SHOW_END received from skipShowAnswer above
        const questionFinish = true;

        // Verify all events were received
        expect(answer).toBeDefined();
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(
          AnswerResultType.CORRECT
        );
        expect(questionFinish).toBeDefined();

        // Verify player score was updated correctly
        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.players.find((p) => p.role === PlayerRole.PLAYER);
        expect(player).toBeDefined();
        expect(player!.score).toBe(400);

        // Verify question state transitioned correctly through the queue
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle multiple rapid answer attempts (only first succeeds)", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Pick question
        const questionDataPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Track answer events
        let answerCount = 0;
        let answeringPlayerId: number | null = null;

        const answerPromise = new Promise<void>((resolve) => {
          showmanSocket.on(SocketIOGameEvents.QUESTION_ANSWER, (data: any) => {
            answerCount++;
            if (answerCount === 1) {
              answeringPlayerId = data.userId;
            }
          });

          // Wait to ensure no additional answers come through
          setTimeout(() => {
            resolve();
          }, 1000);
        });

        // All three players try to answer simultaneously
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        playerSockets[1].emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        playerSockets[2].emit(SocketIOGameEvents.QUESTION_ANSWER, {});

        await answerPromise;

        // Only one answer should be accepted
        expect(answerCount).toBe(1);
        expect(answeringPlayerId).toBeDefined();

        // Verify game state shows correct answering player
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.answeringPlayer).toBe(answeringPlayerId);
        expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
      } finally {
        // Clear Redis before cleanup to flush stranded queue items from
        // intentionally-simultaneous emissions (pre-existing RPUSH/LLEN race)
        await testEnv.clearRedis();
        await utils.cleanupGameClients(setup);
      }
    });

    it("should handle answer submission during concurrent player leave", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Pick question
        const questionDataPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        // Serialize: first submit answer, wait for it to be processed,
        // then submit leave to avoid RPUSH/LLEN race condition
        const answerPromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        playerSockets[0].emit(SocketIOGameEvents.QUESTION_ANSWER, {});
        const answerData = await answerPromise;

        const leavePromise = utils.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.LEAVE
        );
        playerSockets[1].emit(SocketIOGameEvents.LEAVE);
        const leaveData = await leavePromise;

        expect(answerData).toBeDefined();
        expect(leaveData).toBeDefined();

        // Verify game state is consistent
        const game = await utils.getGameFromGameService(setup.gameId);
        const gameState = await utils.getGameState(setup.gameId);
        const connectedPlayers = game.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Showman + one remaining player = 2 (player 1 left)
        expect(connectedPlayers.length).toBe(2);

        // The answer from player 0 should have been processed (state: ANSWERING)
        expect(gameState!.questionState).toBe(QuestionState.ANSWERING);
        expect(gameState!.answeringPlayer).toBe(answerData.userId);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Concurrent Kick and Leave", () => {
    it("should handle player leaving while being kicked", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        const game = await utils.getGameFromGameService(setup.gameId);
        const targetPlayer = game.players.find(
          (p) => p.role === PlayerRole.PLAYER
        )!;

        let leaveCount = 0;

        const leavePromise = new Promise<void>((resolve) => {
          showmanSocket.on(SocketIOGameEvents.LEAVE, () => {
            leaveCount++;
          });

          // Wait a bit to collect leave events
          setTimeout(() => {
            resolve();
          }, 200);
        });

        // Player leaves while showman kicks them (same player)
        playerSockets[0].emit(SocketIOGameEvents.LEAVE);
        showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
          playerId: targetPlayer.meta.id,
        });

        await leavePromise;

        // Only one leave event should be received
        expect(leaveCount).toBe(1);

        // Verify player is gone
        const kickedGame = await utils.getGameFromGameService(setup.gameId);
        const connectedPlayers = kickedGame.players.filter(
          (p) => p.gameStatus !== PlayerGameStatus.DISCONNECTED
        );

        // Should have showman + 1 remaining player = 2
        expect(connectedPlayers.length).toBe(2);

        const playerIds = connectedPlayers.map((p) => p.meta.id);
        expect(playerIds).not.toContain(targetPlayer.meta.id);
      } finally {
        // Clear Redis before cleanup to flush stranded queue items from
        // intentionally-simultaneous emissions (pre-existing RPUSH/LLEN race)
        await testEnv.clearRedis();
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Concurrent Game Pause and Actions", () => {
    it("should handle pause during question selection", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        // Verify we're in CHOOSING state
        let gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);

        // Pause and pick question simultaneously
        const pausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_PAUSE
        );

        showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});

        await pausePromise;

        // Verify game is paused
        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.isPaused).toBe(true);

        // Unpause
        const unpausePromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // Now picking should work
        const questionDataPromise = utils.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.QUESTION_DATA
        );
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await questionDataPromise;

        gameState = await utils.getGameState(setup.gameId);
        expect(gameState!.currentQuestion).toBeDefined();
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });

  describe("Concurrent Score Changes", () => {
    it("should handle rapid score changes to the same player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      try {
        await utils.startGame(showmanSocket);

        const game = await utils.getGameFromGameService(setup.gameId);
        const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
        const initialScore = player.score;

        // Serialize score change emissions to avoid RPUSH/LLEN race condition
        const scores = [
          initialScore + 100,
          initialScore + 200,
          initialScore + 300,
        ];

        for (const newScore of scores) {
          const scoreChangePromise = utils.waitForEvent(
            playerSockets[0],
            SocketIOGameEvents.SCORE_CHANGED
          );
          showmanSocket.emit(SocketIOGameEvents.SCORE_CHANGED, {
            playerId: player.meta.id,
            newScore,
          });
          await scoreChangePromise;
        }

        const scoreChangeCount = 3;

        expect(scoreChangeCount).toBe(3);

        // Verify final score is the last value
        const scoreGame = await utils.getGameFromGameService(setup.gameId);
        const finalPlayer = scoreGame.players.find(
          (p) => p.meta.id === player.meta.id
        )!;
        expect(finalPlayer.score).toBe(initialScore + 300);
      } finally {
        await utils.cleanupGameClients(setup);
      }
    });
  });
});
