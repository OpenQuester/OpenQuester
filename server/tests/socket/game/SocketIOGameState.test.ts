import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Socket Game State Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Round Management", () => {
    it("should handle round skip", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      const gameData = await utils.startGame(showmanSocket);
      const orderBeforeSkip = gameData.currentRound.order;

      const nextRoundPromise = utils.waitForEvent<GameNextRoundEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.NEXT_ROUND
      );

      // Progress to next round
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});

      const data = await nextRoundPromise;
      expect(data.gameState).toBeDefined();
      expect(data.gameState.currentRound).toBeDefined();
      expect(data.gameState.currentRound?.order).toBe(orderBeforeSkip + 1);
    });

    it("should handle game finish", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, false);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      const gameFinished = await utils.runAndWaitForEvent<boolean>(
        playerSockets[0],
        SocketIOGameEvents.GAME_FINISHED,
        async () => {
          await utils.progressToNextRound(showmanSocket);
          showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
        }
      );

      // Simulate game finish by forcing next round twice (package has 2 rounds)
      expect(gameFinished).toBe(true);
    });

    it("should handle game finish via all questions played", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, false);
      const { showmanSocket, playerSockets, gameId } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      const nextRoundPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.NEXT_ROUND);
      showmanSocket.emit(SocketIOGameEvents.NEXT_ROUND, {});
      await nextRoundPromise;

      const questionId = await utils.getFirstAvailableQuestionId(gameId);
      const gameFinished = await utils.runAndWaitForEvent<boolean>(
        playerSockets[0],
        SocketIOGameEvents.GAME_FINISHED,
        () =>
          utils.pickAndCompleteQuestion(
            showmanSocket,
            playerSockets,
            questionId,
            true,
            AnswerResultType.CORRECT,
            100,
            0
          )
      );

      expect(gameFinished).toBe(true);
    });

    it("should handle game finish via all questions played (last question skipped)", async () => {
      // Setup game WITHOUT final round so completion of regular questions finishes the game
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0, false);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      // Start game
      await utils.startGame(showmanSocket);
      await utils.setPlayerScore(gameId, playerUsers[0].id, 10000);
      await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

      // Get all questions ordered
      const questions = await utils.getAllAvailableQuestionIds(gameId);
      expect(questions.length).toBeGreaterThan(0);

      // --- ROUND 1 ---
      // Play all questions except the last one in Round 1
      for (let i = 0; i < questions.length - 1; i++) {
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          questions[i],
          true,
          AnswerResultType.CORRECT,
          100,
          0
        );
      }

      // Setup listener for next round BEFORE playing the last question
      const nextRoundPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.NEXT_ROUND);

      // Play the last question of Round 1
      await utils.pickAndCompleteQuestion(
        showmanSocket,
        playerSockets,
        questions[questions.length - 1],
        true,
        AnswerResultType.CORRECT,
        100,
        0
      );

      // Wait for next round transition
      await nextRoundPromise; // --- ROUND 2 ---
      // Get questions for Round 2
      const round2Questions = await utils.getAllAvailableQuestionIds(gameId);
      expect(round2Questions.length).toBeGreaterThan(0);

      // Play all questions except the last one in Round 2
      for (let i = 0; i < round2Questions.length - 1; i++) {
        await utils.pickAndCompleteQuestion(
          showmanSocket,
          playerSockets,
          round2Questions[i],
          true,
          AnswerResultType.CORRECT,
          100,
          0
        );
      }

      // For the last question of Round 2, pick it then skip it
      const lastQuestionId = round2Questions[round2Questions.length - 1];

      const gameFinished = await utils.runAndWaitForEvent(
        showmanSocket,
        SocketIOGameEvents.GAME_FINISHED,
        () => utils.pickAndCompleteQuestion(showmanSocket, playerSockets, lastQuestionId, false)
      );

      // Verify game finished
      expect(gameFinished).toBe(true);
      const game = await utils.getGameFromGameService(gameId);
      expect(game?.finishedAt).toBeTruthy();
    });
  });

  describe("Game State Synchronization", () => {
    it("should handle game state synchronization for late joiners", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { gameId } = setup;

      // Create a new player that joins mid-game
      const { socket: lateJoinSocket } = await utils.createGameClient(app, userRepo);

      const gameDataPromise = utils.waitForEvent<{
        gameState: unknown;
        players: unknown;
      }>(lateJoinSocket, SocketIOGameEvents.GAME_DATA);

      // Join game
      lateJoinSocket.emit(SocketIOGameEvents.JOIN, {
        gameId,
        role: PlayerRole.PLAYER,
        targetSlot: null
      } satisfies GameJoinInputData);

      const data = await gameDataPromise;
      expect(data.gameState).toBeDefined();
      expect(data.players).toBeDefined();
    });
  });

  describe("Game Pause Management", () => {
    it("should handle game pause and unpause", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { showmanSocket, playerSockets } = setup;

      // Start game
      await utils.startGame(showmanSocket);

      const pausePromise = utils.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);

      // Pause game
      showmanSocket.emit(SocketIOGameEvents.GAME_PAUSE, {});
      await pausePromise;

      const unpausePromise = utils.waitForEvent<{ timer: unknown }>(
        playerSockets[0],
        SocketIOGameEvents.GAME_UNPAUSE
      );

      // Unpause game after pause
      showmanSocket.emit(SocketIOGameEvents.GAME_UNPAUSE, {});

      expect((await unpausePromise).timer).toBeDefined();
    });

    it("should not allow player to pause/unpause game", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      const { playerSockets } = setup;

      const errorPromise = utils.waitForEvent<{ message: string }>(
        playerSockets[0],
        SocketIOEvents.ERROR
      );

      // Try to pause game as player
      playerSockets[0].emit(SocketIOGameEvents.GAME_PAUSE, {});

      expect((await errorPromise).message).toBe("Only showman can pause the game");
    }, 15000);
  });
});
