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
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Game Statistics Persistence Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let _app: Express;
  let userRepo: Repository<User>;
  let gameStatsRepo: Repository<GameStatistics>;
  let playerGameStatsRepo: Repository<PlayerGameStats>;
  let serverUrl: string;
  let utils: SocketGameTestUtils;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    _app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    gameStatsRepo = testEnv.getDatabase().getRepository(GameStatistics);
    playerGameStatsRepo = testEnv.getDatabase().getRepository(PlayerGameStats);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
    await playerGameStatsRepo.delete({});
    await gameStatsRepo.delete({});
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  it("should record statistics to database when game ends", async () => {
    // Setup game with 1 player
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0);
    const { showmanSocket, playerSockets } = setup;

    try {
      // Start game
      await utils.startGame(showmanSocket);

      // Wait for game to finish
      const gameFinishedPromise = new Promise((resolve) => {
        playerSockets[0].on(SocketIOGameEvents.NEXT_ROUND, () => {
          showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
        });

        playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data) => {
          resolve(data);
        });
      });

      // Start the game finish sequence by emitting first NEXT_ROUND
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

      // Wait for game finish event
      const gameFinishedData = await gameFinishedPromise;
      expect(gameFinishedData).toBe(true);

      // Now verify statistics were recorded to database
      const savedStats = await gameStatsRepo.find();

      expect(savedStats).toBeDefined();
      expect(savedStats.length).toBeGreaterThan(0);

      const gameStats = savedStats[0];
      expect(gameStats.started_at).toBeDefined();
      expect(gameStats.finished_at).toBeDefined();
      expect(gameStats.duration).toBeGreaterThan(0);
      expect(gameStats.created_by).toBeDefined();
    } finally {
      // Cleanup sockets
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
    }
  });

  it("should record statistics to database when game ends via answer result", async () => {
    // Setup game with 1 player
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0);
    const { showmanSocket, playerSockets } = setup;

    try {
      // Start game
      await utils.startGame(showmanSocket);

      // Wait for game to finish via answer result instead of next round
      const gameFinishedPromise = new Promise((resolve) => {
        let nextRoundCount = 0;

        playerSockets[0].on(SocketIOGameEvents.NEXT_ROUND, async () => {
          nextRoundCount++;
          if (nextRoundCount === 1) {
            // First next round - advance to final round
            showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
          } else {
            // Instead of second next round that would end game, use answer-result
            // First need to pick a question to have a valid questionId for answer-result
            let finalQuestionId: number = 0;

            showmanSocket.once(
              SocketIOGameEvents.QUESTION_DATA,
              (questionData) => {
                finalQuestionId = questionData.id;

                // Then emit answer-result to end the game
                showmanSocket.emit(SocketIOGameEvents.ANSWER_RESULT, {
                  questionId: finalQuestionId,
                  answerType: AnswerResultType.CORRECT,
                  scoreResult: 100,
                });
              }
            );

            // Pick a question in final round to get valid questionId
            await utils.pickQuestion(showmanSocket);
          }
        });

        playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data) => {
          resolve(data);
        });
      });

      // Start the game finish sequence by emitting first NEXT_ROUND
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

      // Wait for game finish event
      const gameFinishedData = await gameFinishedPromise;
      expect(gameFinishedData).toBe(true);

      // Now verify statistics were recorded to database
      const savedStats = await gameStatsRepo.find();

      expect(savedStats).toBeDefined();
      expect(savedStats.length).toBeGreaterThan(0);

      const gameStats = savedStats[0];
      expect(gameStats.started_at).toBeDefined();
      expect(gameStats.finished_at).toBeDefined();
      expect(gameStats.duration).toBeGreaterThan(0);
      expect(gameStats.created_by).toBeDefined();
    } finally {
      // Cleanup sockets
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
    }
  });

  it("should record statistics to database when game ends via skip question force", async () => {
    // Setup game with 1 player
    const setup = await utils.setupGameTestEnvironment(userRepo, _app, 1, 0);
    const { showmanSocket, playerSockets } = setup;

    try {
      // Start game
      await utils.startGame(showmanSocket);

      // Skip first round to get to final round
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

      // Wait for game to finish via skipping all questions in final round
      const gameFinishedPromise = new Promise((resolve) => {
        playerSockets[0].on(SocketIOGameEvents.GAME_FINISHED, (data) => {
          resolve(data);
        });

        // TODO: This will break when we add server-side timer for question results showing
        // * We wont't be able to pick question while previous one is showing answer
        const skipAllQuestions = async () => {
          try {
            // Pick question then immediately skip it
            await utils.pickQuestion(showmanSocket);
            showmanSocket.emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});

            // Continue skipping questions until all are done
            setTimeout(skipAllQuestions, 100);
          } catch {
            // If we can't pick more questions, the game should finish soon
          }
        };

        // Start skipping questions after a short delay
        setTimeout(skipAllQuestions, 100);
      });

      // Wait for game finish event
      const gameFinishedData = await gameFinishedPromise;
      expect(gameFinishedData).toBe(true);

      // Verify statistics were recorded to database
      const savedStats = await gameStatsRepo.find();

      expect(savedStats).toBeDefined();
      expect(savedStats.length).toBeGreaterThan(0);

      const gameStats = savedStats[0];
      expect(gameStats.started_at).toBeDefined();
      expect(gameStats.finished_at).toBeDefined();
      expect(gameStats.duration).toBeGreaterThan(0);
      expect(gameStats.created_by).toBeDefined();
    } finally {
      // Cleanup sockets
      showmanSocket.disconnect();
      playerSockets.forEach((socket) => socket.disconnect());
    }
  });
});
