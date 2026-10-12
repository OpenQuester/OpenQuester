import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SYSTEM_PLAYER_ID, SYSTEM_SOCKET_ID } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { type GameAction, type GameActionResult } from "domain/types/action/GameAction";
import { type TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { ValueUtils } from "domain/utils/ValueUtils";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

describe("Socket Timer and Pause Edge Cases", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  async function submitTimerExpiration(
    gameId: string,
    actionType: GameActionType,
    questionState: QuestionState,
    key: string = timerKey(gameId)
  ): Promise<GameActionResult> {
    const actionExecutor = container.resolve(GameActionExecutor);
    const action: GameAction<TimerActionPayload> = {
      id: ValueUtils.generateUUID(),
      type: actionType,
      gameId,
      playerId: SYSTEM_PLAYER_ID,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload: {
        timerKey: key,
        questionState,
        expirationTime: new Date()
      }
    };

    return actionExecutor.submitAction(action);
  }

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

  describe("Game Pause Edge Cases", () => {
    it("should ignore stale timer action when game is choosing", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        await utils.startGame(showmanSocket);

        const choosingState = await utils.getGameState(setup.gameId);
        expect(choosingState).toBeDefined();
        expect(choosingState!.questionState).toBe(QuestionState.CHOOSING);
        expect(choosingState!.timer).toBeNull();

        const result = await submitTimerExpiration(
          setup.gameId,
          GameActionType.TIMER_QUESTION_SHOWING_EXPIRED,
          QuestionState.CHOOSING
        );

        expect(result.success).toBe(true);
        await utils.waitForActionsComplete(setup.gameId);
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.timer).toBeNull();
      });
    });

    it("should handle pausing game during question selection", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game and enter question selection phase
        await utils.startGame(showmanSocket);

        // Game should be in CHOOSING state with no current question
        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.CHOOSING);
        expect(gameState!.currentQuestion).toBeNull();

        // Pause game during selection phase
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify game is paused and timer state is preserved
        expect(pauseData.timer).toBeDefined();
        const pausedGameState = await utils.getGameState(setup.gameId);
        expect(pausedGameState).toBeDefined();
        expect(pausedGameState!.isPaused).toBe(true);
        expect(pausedGameState!.questionState).toBe(QuestionState.CHOOSING);

        // Resume and verify continuation
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        expect(unpauseData.timer).toBeDefined();
        const resumedGameState = await utils.getGameState(setup.gameId);
        expect(resumedGameState).toBeDefined();
        expect(resumedGameState!.isPaused).toBe(false);
        expect(resumedGameState!.questionState).toBe(QuestionState.CHOOSING);
      });
    });

    it("should handle pausing game during active answer period", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Present question and start answer timer
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify game is in SHOWING state
        const showingState = await utils.getGameState(setup.gameId);
        expect(showingState).toBeDefined();
        expect(showingState!.questionState).toBe(QuestionState.SHOWING);
        expect(showingState!.currentQuestion).toBeDefined();
        expect(showingState!.timer).toBeDefined();

        // Player starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify game is in ANSWERING state
        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBeDefined();

        // Pause game mid-answer period
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify answer timer pause and answer state preservation
        expect(pauseData.timer).toBeDefined();
        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);
        expect(pausedState!.questionState).toBe(QuestionState.ANSWERING);
        expect(pausedState!.answeringPlayer).toBeDefined();

        // Resume and verify continuation
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        expect(unpauseData.timer).toBeDefined();
        const resumedState = await utils.getGameState(setup.gameId);
        expect(resumedState).toBeDefined();
        expect(resumedState!.isPaused).toBe(false);
        expect(resumedState!.questionState).toBe(QuestionState.ANSWERING);
        expect(resumedState!.answeringPlayer).toBeDefined();
      });
    });

    it("should ignore answer timer expiration while game is paused", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);
        expect(pausedState!.questionState).toBe(QuestionState.ANSWERING);
        expect(pausedState!.timer).toBeNull();

        const result = await submitTimerExpiration(
          setup.gameId,
          GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED,
          QuestionState.ANSWERING
        );

        expect(result.success).toBe(true);
        await utils.waitForActionsComplete(setup.gameId);
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.isPaused).toBe(true);
        expect(finalState!.questionState).toBe(QuestionState.ANSWERING);
        expect(finalState!.answeringPlayer).toBe(pausedState!.answeringPlayer);
      });
    });

    it("should ignore saved showing timer action during answer period", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        const answeringState = await utils.getGameState(setup.gameId);
        expect(answeringState).toBeDefined();
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.timer).toBeDefined();

        const result = await submitTimerExpiration(
          setup.gameId,
          GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED,
          QuestionState.ANSWERING,
          timerKey(setup.gameId, QuestionState.SHOWING)
        );

        expect(result.success).toBe(true);
        await utils.waitForActionsComplete(setup.gameId);
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.questionState).toBe(QuestionState.ANSWERING);
        expect(finalState!.answeringPlayer).toBe(answeringState!.answeringPlayer);
      });
    });

    it("should ignore stake bidding timer expiration while game is paused", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, playerUsers } = setup;

        await utils.startGame(showmanSocket);
        await utils.setPlayerScore(setup.gameId, playerUsers[0].id, 500);
        await utils.setPlayerScore(setup.gameId, playerUsers[1].id, 300);
        await utils.setCurrentTurnPlayer(showmanSocket, playerUsers[0].id);

        const stakeQuestionId = await utils.getQuestionIdByType(
          setup.gameId,
          PackageQuestionType.STAKE
        );
        const stakePickedPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.STAKE_QUESTION_PICKED
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: stakeQuestionId
        });
        await stakePickedPromise;

        const biddingState = await utils.getGameState(setup.gameId);
        expect(biddingState).toBeDefined();
        expect(biddingState!.questionState).toBe(QuestionState.BIDDING);
        expect(biddingState!.timer).toBeDefined();

        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);
        expect(pausedState!.questionState).toBe(QuestionState.BIDDING);
        expect(pausedState!.timer).toBeNull();

        const result = await submitTimerExpiration(
          setup.gameId,
          GameActionType.TIMER_BIDDING_EXPIRED,
          QuestionState.BIDDING
        );

        expect(result.success).toBe(true);
        await utils.waitForActionsComplete(setup.gameId);
        const finalState = await utils.getGameState(setup.gameId);
        expect(finalState).toBeDefined();
        expect(finalState!.isPaused).toBe(true);
        expect(finalState!.questionState).toBe(QuestionState.BIDDING);
        expect(finalState!.stakeQuestionData).toBeDefined();
      });
    });

    it("should handle pausing already paused game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        // Start and pause game
        await utils.startGame(showmanSocket);
        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);

        // Send another PAUSE_GAME event - should emit error
        const errorPromise = scenario.waitForEvent(showmanSocket, SocketIOEvents.ERROR);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});
        const errorData = await errorPromise;

        // Verify error message
        expect(errorData.message).toBe("Game is paused");

        // Verify game remains paused
        const stillPausedState = await utils.getGameState(setup.gameId);
        expect(stillPausedState).toBeDefined();
        expect(stillPausedState!.isPaused).toBe(true);
      });
    });
  });

  describe("Game Resume Edge Cases", () => {
    it("should handle resuming non-paused game", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Start game (not paused)
        await utils.startGame(showmanSocket);

        const gameState = await utils.getGameState(setup.gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.isPaused).toBe(false);

        // Send RESUME_GAME event - should handle gracefully
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        // Verify appropriate handling - game remains unpaused
        expect(unpauseData.timer).toBeDefined();
        const stillUnpausedState = await utils.getGameState(setup.gameId);
        expect(stillUnpausedState).toBeDefined();
        expect(stillUnpausedState!.isPaused).toBe(false);
      });
    });

    it("should handle multiple resume requests", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        // Pause game
        await utils.startGame(showmanSocket);
        await utils.pauseGame(showmanSocket);

        const pausedState = await utils.getGameState(setup.gameId);
        expect(pausedState).toBeDefined();
        expect(pausedState!.isPaused).toBe(true);

        // Send multiple RESUME_GAME events rapidly
        const acceptedActions = utils.createAcceptedActionProbe({
          gameId: setup.gameId,
          actionType: GameActionType.UNPAUSE
        });
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );

        try {
          for (let i = 0; i < 5; i++) {
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
          }

          const [unpauseData] = await Promise.all([
            unpausePromise,
            acceptedActions.waitForCount(5)
          ]);
          await utils.waitForActionsComplete(setup.gameId);

          // Verify single resume occurs
          expect(unpauseData.timer).toBeDefined();
          expect(acceptedActions.records()).toHaveLength(5);

          // Verify game state consistency
          const resumedState = await utils.getGameState(setup.gameId);
          expect(resumedState).toBeDefined();
          expect(resumedState!.isPaused).toBe(false);

          // Ensure game state is consistent
          const finalGameFromService = await utils.getGameFromGameService(setup.gameId);
          expect(finalGameFromService.gameState.isPaused).toBe(false);
        } finally {
          acceptedActions.dispose();
        }
      });
    });
  });
});
