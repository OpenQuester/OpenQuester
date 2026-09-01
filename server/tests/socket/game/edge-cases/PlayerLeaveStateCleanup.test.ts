import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Player Leave State Cleanup Edge Cases", () => {
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

  describe("Current Turn Player Leaves", () => {
    it("should clear currentTurnPlayerId when current turn player leaves during question selection", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      await utils.startGame(showmanSocket);

      // Get current game state to identify turn player
      const gameStateBefore = await utils.getGameState(gameId);
      expect(gameStateBefore!.currentTurnPlayerId).toBeDefined();
      const turnPlayerId = gameStateBefore!.currentTurnPlayerId!;

      // Find the socket for the turn player
      const turnPlayerIndex = playerUsers.findIndex((u) => u.id === turnPlayerId);
      expect(turnPlayerIndex).toBeGreaterThanOrEqual(0);

      const turnPlayerSocket = playerSockets[turnPlayerIndex];
      const otherPlayerSocket = playerSockets[1 - turnPlayerIndex];

      // Turn player leaves
      const leavePromise = utils.waitForEvent(otherPlayerSocket, SocketIOGameEvents.LEAVE);
      turnPlayerSocket.emit(SocketIOGameEvents.LEAVE);
      await leavePromise;

      // Verify currentTurnPlayerId is cleared
      const gameStateAfter = await utils.getGameState(gameId);

      // CurrentTurnPlayerId should be null (not auto-assigned)
      expect(gameStateAfter!.currentTurnPlayerId).toBeNull();
    });

    it("should handle new player joining after current turn player leaves", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

      await utils.startGame(showmanSocket);

      const gameStateBefore = await utils.getGameState(gameId);
      const turnPlayerId = gameStateBefore!.currentTurnPlayerId!;

      const turnPlayerIndex = playerUsers.findIndex((u) => u.id === turnPlayerId);
      const turnPlayerSocket = playerSockets[turnPlayerIndex];

      // Turn player leaves
      const leavePromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      turnPlayerSocket.emit(SocketIOGameEvents.LEAVE);
      await leavePromise;

      // New player joins
      const { socket: newPlayerSocket, user: newPlayerUser } = await utils.createGameClient(
        app,
        userRepo
      );
      const joinPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.JOIN);
      await utils.joinGame(newPlayerSocket, gameId, PlayerRole.PLAYER);
      await joinPromise;

      // Verify game state is consistent
      const gameStateAfter = await utils.getGameState(gameId);

      // New player should have joined successfully
      const game = await utils.getGameFromGameService(gameId);
      const newPlayer = game.getPlayer(newPlayerUser.id, {
        fetchDisconnected: false
      });
      expect(newPlayer).toBeDefined();

      // CurrentTurnPlayerId should be null (not auto-assigned)
      expect(gameStateAfter!.currentTurnPlayerId).toBeNull();
    });
  });

  describe("Answering Player Leaves", () => {
    it("should auto-skip answer when answering player leaves during ANSWERING state", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Player starts answering
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      const answeringState = await utils.getGameState(gameId);
      expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
      expect(answeringState!.answeringPlayer).toBeDefined();
      const answeringPlayerId = answeringState!.answeringPlayer!;

      // Get answering player's score before leaving
      const game = await utils.getGameFromGameService(gameId);
      const answeringPlayerBefore = game.getPlayer(answeringPlayerId, {
        fetchDisconnected: false
      });
      const scoreBefore = answeringPlayerBefore!.score;

      // Set up listener for answer result (auto-skip should trigger this)
      const answerResultPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT
      );

      // Answering player leaves
      playerSockets[0].emit(SocketIOGameEvents.LEAVE);

      // Should receive automatic answer result with 0 points
      const answerResultData = await answerResultPromise;
      expect(answerResultData).toBeDefined();
      expect(answerResultData.answerResult).toBeDefined();
      expect(answerResultData.answerResult.player).toBe(answeringPlayerId);
      expect(answerResultData.answerResult.result).toBe(0);

      // Verify answeringPlayer is cleared
      const gameStateAfter = await utils.getGameState(gameId);
      expect(gameStateAfter!.answeringPlayer).toBeNull();
      expect(gameStateAfter!.questionState).not.toBe(QuestionState.ANSWERING);

      // Verify disconnected player's score is unchanged
      const gameAfter = await utils.getGameFromGameService(gameId);
      const answeringPlayerAfter = gameAfter.getPlayer(answeringPlayerId, {
        fetchDisconnected: true
      });
      expect(answeringPlayerAfter).toBeDefined();
      expect(answeringPlayerAfter!.score).toBe(scoreBefore);
    });

    it("should allow other players to answer after answering player leaves", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Player 1 starts answering
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      const answeringState = await utils.getGameState(gameId);
      expect(answeringState!.answeringPlayer).toBeDefined();

      // Wait for auto-skip answer result
      const answerResultPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT
      );

      // Answering player leaves
      playerSockets[0].emit(SocketIOGameEvents.LEAVE);
      await answerResultPromise;

      // Verify game returned to SHOWING state
      const stateAfterLeave = await utils.getGameState(gameId);
      expect(stateAfterLeave!.questionState).toBe(QuestionState.SHOWING);
      expect(stateAfterLeave!.answeringPlayer).toBeNull();

      // Player 2 should be able to answer
      const answerPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_ANSWER);
      playerSockets[1].emit(SocketIOGameEvents.QUESTION_ANSWER);
      await answerPromise;

      const answeringState2 = await utils.getGameState(gameId);
      expect(answeringState2!.questionState).toBe(QuestionState.ANSWERING);
      expect(answeringState2!.answeringPlayer).toBe(setup.playerUsers[1].id);
    });
  });

  describe("Kick During Game States", () => {
    it("should clear currentTurnPlayerId when showman kicks current turn player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, gameId } = setup;

      await utils.startGame(showmanSocket);

      // Verify game is in CHOOSING state with a turn player
      const initialState = await utils.getGameState(gameId);
      expect(initialState!.questionState).toBe(QuestionState.CHOOSING);
      expect(initialState!.currentTurnPlayerId).toBeDefined();

      const turnPlayerId = initialState!.currentTurnPlayerId!;

      const kickPromise = utils.waitForEvent(showmanSocket, SocketIOGameEvents.PLAYER_KICKED);

      // Showman kicks the current turn player
      showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
        playerId: turnPlayerId
      });

      await kickPromise;

      // Verify currentTurnPlayerId is cleared (same behavior as leave)
      const stateAfterKick = await utils.getGameState(gameId);
      expect(stateAfterKick!.currentTurnPlayerId).toBeNull();
    });

    it("should auto-skip answer when showman kicks answering player", async () => {
      const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      const { showmanSocket, playerSockets, gameId } = setup;

      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);

      // Player starts answering
      await utils.answerQuestion(playerSockets[0], showmanSocket);

      const answeringState = await utils.getGameState(gameId);
      expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
      const answeringPlayerId = answeringState!.answeringPlayer!;

      const answerResultPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT
      );

      // Showman kicks the answering player
      showmanSocket.emit(SocketIOGameEvents.PLAYER_KICKED, {
        playerId: answeringPlayerId
      });

      // Should receive automatic answer result with 0 points (same as leave)
      const answerResultData = await answerResultPromise;
      expect(answerResultData.answerResult.player).toBe(answeringPlayerId);
      expect(answerResultData.answerResult.result).toBe(0);

      // Verify answeringPlayer is cleared
      const stateAfterKick = await utils.getGameState(gameId);
      expect(stateAfterKick!.answeringPlayer).toBeNull();
      expect(stateAfterKick!.questionState).not.toBe(QuestionState.ANSWERING);
    });
  });
});
