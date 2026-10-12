import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
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

  describe("Restriction During Answering", () => {
    it("should auto-skip answer with 0 points when answering player is restricted", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

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
          fetchDisconnected: false
        });
        const scoreBefore = answeringPlayerBefore!.score;

        // Set up listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Showman restricts the answering player
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[0].id,
          muted: false,
          restricted: true,
          banned: false
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
          fetchDisconnected: false
        });
        expect(restrictedPlayer).toBeDefined();
        expect(restrictedPlayer!.score).toBe(scoreBefore);
      });
    });

    it("should allow other players to answer after answering player is restricted", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 0 starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);

        // Wait for auto-skip answer result
        const answerResultPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Restrict the answering player
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: playerUsers[0].id,
          muted: false,
          restricted: true,
          banned: false
        });

        await answerResultPromise;

        // Verify game returned to SHOWING state
        const stateAfterRestriction = await utils.getGameState(gameId);
        expect(stateAfterRestriction!.questionState).toBe(QuestionState.SHOWING);
        expect(stateAfterRestriction!.answeringPlayer).toBeNull();

        // Player 1 should be able to answer
        const answerPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_ANSWER);
        await answerPromise;

        const answeringState2 = await utils.getGameState(gameId);
        expect(answeringState2!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState2!.answeringPlayer).toBe(playerUsers[1].id);
      });
    });
  });

  describe("Restriction During Turn", () => {
    it("should clear currentTurnPlayerId when turn player is restricted during question selection", async () => {
      await suite.scenario(async (scenario) => {
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

        // Wait for both PLAYER_RESTRICTED and TURN_PLAYER_CHANGED events
        const restrictionPromise = scenario.waitForEvent(
          playerSockets[1 - turnPlayerIndex],
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        // Restrict the turn player
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: turnPlayerId,
          muted: false,
          restricted: true,
          banned: false
        });

        await restrictionPromise;

        // Verify currentTurnPlayerId is cleared
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();
      });
    });

    it("should not crash when turn player is restricted and only one active player remains", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, gameId, playerUsers } = setup;

        await utils.startGame(showmanSocket);

        const gameStateBefore = await utils.getGameState(gameId);
        const turnPlayerId = gameStateBefore!.currentTurnPlayerId!;

        // Restrict the turn player
        const restrictionPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.PLAYER_RESTRICTED
        );

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.PLAYER_RESTRICTED, {
          playerId: turnPlayerId,
          muted: false,
          restricted: true,
          banned: false
        });

        await restrictionPromise;

        // Game should still be operational with only one active player
        const gameStateAfter = await utils.getGameState(gameId);
        expect(gameStateAfter).toBeDefined();
        expect(gameStateAfter!.currentTurnPlayerId).toBeNull();

        // Verify showman can assign turn to remaining player
        const otherPlayerId = playerUsers.find((u) => u.id !== turnPlayerId)!.id;
        await utils.setCurrentTurnPlayer(showmanSocket, otherPlayerId);

        const gameStateWithTurn = await utils.getGameState(gameId);
        expect(gameStateWithTurn!.currentTurnPlayerId).toBe(otherPlayerId);
      });
    });
  });
});
