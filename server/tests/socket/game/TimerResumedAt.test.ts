import { afterAll, beforeAll, afterEach, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { TestUtils } from "tests/utils/TestUtils";
import { RedisConfig } from "shared/config/RedisConfig";

/**
 * Tests for GameStateTimerDTO.resumedAt field
 *
 * The resumedAt field tracks when a timer was resumed after being paused or restored.
 * This is critical for users joining mid-game to calculate the correct elapsed time.
 *
 * Use cases:
 * 1. Timer resumed after game unpause
 * 2. Timer restored after wrong answer (back to SHOWING state)
 * 3. Timer restored after answer timeout expiration
 */
describe("Timer resumedAt Field", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;
  let testUtils: TestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    utils = suite.utils;
    testUtils = suite.testUtils;
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Timer initialization", () => {
    it("should have null resumedAt when timer is first started", async () => {
      await suite.scenario(async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start game
        await utils.startGame(showmanSocket);

        // Pick a question to start timer
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify timer exists and resumedAt is null (fresh timer)
        const gameState = await utils.getGameState(gameId);
        expect(gameState).toBeDefined();
        expect(gameState!.questionState).toBe(QuestionState.SHOWING);
        expect(gameState!.timer).toBeDefined();
        expect(gameState!.timer!.resumedAt).toBeNull();
        expect(gameState!.timer!.startedAt).toBeDefined();
      });
    });
  });

  describe("Timer resume after unpause", () => {
    it("should set resumedAt when game is unpaused", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        // Start game and pick question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer state - resumedAt should be null
        const initialState = await utils.getGameState(gameId);
        expect(initialState!.timer!.resumedAt).toBeNull();

        // Pause game
        const pausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_PAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE, {});
        const pauseData = await pausePromise;

        // Verify paused timer has elapsed time tracked
        expect(pauseData.timer).toBeDefined();
        expect(pauseData.timer.elapsedMs).toBeGreaterThanOrEqual(0);

        // Unpause game
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;

        // Verify resumed timer has resumedAt set
        expect(unpauseData.timer).toBeDefined();
        expect(unpauseData.timer.resumedAt).toBeDefined();
        expect(unpauseData.timer.resumedAt).not.toBeNull();

        // Verify game state also has resumedAt
        const resumedState = await utils.getGameState(gameId);
        expect(resumedState!.timer!.resumedAt).toBeDefined();
        expect(resumedState!.timer!.resumedAt).not.toBeNull();
      });
    });

    it("should have resumedAt as a valid Date close to current time", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Pause and unpause
        await utils.pauseGame(showmanSocket);

        const beforeUnpause = new Date();
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const unpauseData = await unpausePromise;
        const afterUnpause = new Date();

        // Verify resumedAt is within expected time range
        const resumedAt = new Date(unpauseData.timer.resumedAt);
        expect(resumedAt.getTime()).toBeGreaterThanOrEqual(
          beforeUnpause.getTime() - 100 // 100ms tolerance
        );
        expect(resumedAt.getTime()).toBeLessThanOrEqual(afterUnpause.getTime() + 100);
      });
    });

    it("should update resumedAt on subsequent pause/unpause cycles", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // First pause/unpause cycle
        await utils.pauseGame(showmanSocket);
        let unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const firstUnpause = await unpausePromise;
        const firstResumedAt = new Date(firstUnpause.timer.resumedAt).getTime();

        // Second pause/unpause cycle
        await utils.pauseGame(showmanSocket);
        unpausePromise = scenario.waitForEvent(playerSockets[0], SocketIOGameEvents.GAME_UNPAUSE);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        const secondUnpause = await unpausePromise;
        const secondResumedAt = new Date(secondUnpause.timer.resumedAt).getTime();

        // Second resumedAt should be later than first
        expect(secondResumedAt).toBeGreaterThan(firstResumedAt);
      });
    });
  });

  describe("Timer resume after wrong answer", () => {
    it.each(["manual ruling", "skip", "answer timeout"])(
      "rearms the remaining showing timer after %s and reveals the answer on expiry",
      async (trigger) => {
        await suite.scenario(async (scenario) => {
          const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
            userRepo,
            app,
            2,
            0
          );
          await utils.startGame(showmanSocket);
          await utils.pickQuestion(showmanSocket, undefined, playerSockets);
          await utils.answerQuestion(playerSockets[0], showmanSocket);

          const submission = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_SUBMITTED);
          const submissionAccepted = scenario
            .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_SUBMITTED })
            .waitForCount(1);
          scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, {
            answerText: "actual submitted text"
          });
          await Promise.all([submission, submissionAccepted]);
          await scenario.assert.waitForActionsComplete({ gameId });

          const redis = RedisConfig.getClient();
          const savedRaw = await redis.get(timerKey(gameId, QuestionState.SHOWING));
          expect(savedRaw).not.toBeNull();
          const saved = JSON.parse(savedRaw!) as GameStateTimerDTO;
          const result = scenario.waitForEvent(playerSockets[1], SocketIOGameEvents.ANSWER_RESULT);
          if (trigger !== "answer timeout") {
            const accepted = scenario
              .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_RESULT })
              .waitForCount(1);
            scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
              answerType: trigger === "skip" ? AnswerResultType.SKIP : AnswerResultType.WRONG,
              scoreResult: trigger === "skip" ? 0 : -100
            });
            await accepted;
          } else {
            await testUtils.expireTimerAndWaitForAction(
              gameId,
              GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED
            );
          }
          await result;
          await scenario.assert.waitForActionsComplete({ gameId });

          const state = (await utils.getGameState(gameId))!;
          expect(state.questionState).toBe(QuestionState.SHOWING);
          expect(state.timer?.elapsedMs).toBe(saved.elapsedMs);
          expect(state.timer?.resumedAt).toBeTruthy();
          const activeRaw = await redis.get(timerKey(gameId));
          expect(activeRaw).not.toBeNull();
          expect(JSON.parse(activeRaw!)).toEqual(JSON.parse(JSON.stringify(state.timer)));
          const ttl = await redis.pttl(timerKey(gameId));
          expect(ttl).toBeGreaterThan(0);
          expect(ttl).toBeLessThanOrEqual(Math.max(saved.durationMs - saved.elapsedMs, 1));
          expect(await redis.get(timerKey(gameId, QuestionState.SHOWING))).toBeNull();

          const mark = scenario.mark();
          const reveal = scenario.waitForEvent(playerSockets[1], SocketIOGameEvents.QUESTION_FINISH);
          await testUtils.expireTimerAndWaitForAction(
            gameId,
            GameActionType.TIMER_QUESTION_SHOWING_EXPIRED
          );
          await reveal;
          await scenario.assert.waitForActionsComplete({ gameId });
          const revealed = (await utils.getGameState(gameId))!;
          expect(revealed.questionState).toBe(QuestionState.SHOWING_ANSWER);
          expect(revealed.answeredPlayers?.at(-1)?.answerText).toBe("actual submitted text");
          expect(
            scenario.assert.records({
              actor: scenario.actor(playerSockets[1]),
              event: SocketIOGameEvents.QUESTION_FINISH,
              afterSequence: mark
            })
          ).toHaveLength(1);
        });
      }
    );

    it("should set resumedAt when timer is restored after wrong answer", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer has no resumedAt
        const showingState = await utils.getGameState(gameId);
        expect(showingState!.timer!.resumedAt).toBeNull();

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);

        // Showman marks as wrong
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });
        const answerResult = await answerResultPromise;

        // Timer should be restored with resumedAt set
        // (only if there are other players who haven't answered)
        expect(answerResult.timer).toBeDefined();
        expect(answerResult.timer.resumedAt).toBeDefined();
        expect(answerResult.timer.resumedAt).not.toBeNull();

        // Verify game state
        const restoredState = await utils.getGameState(gameId);
        expect(restoredState!.questionState).toBe(QuestionState.SHOWING);
        expect(restoredState!.timer!.resumedAt).not.toBeNull();
      });
    });

    it("should preserve elapsedMs when timer is restored after wrong answer", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Get initial timer state
        const initialState = await utils.getGameState(gameId);
        const initialDurationMs = initialState!.timer!.durationMs;

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Showman marks as wrong
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });
        const answerResult = await answerResultPromise;

        // Verify timer properties
        expect(answerResult.timer.durationMs).toBe(initialDurationMs);
        expect(answerResult.timer.elapsedMs).toBeGreaterThan(0);
        expect(answerResult.timer.resumedAt).not.toBeNull();
      });
    });
  });

  describe("Timer resume after answer timeout", () => {
    it("should set resumedAt when timer is restored after answer timeout", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Verify initial timer has no resumedAt
        const showingState = await utils.getGameState(gameId);
        expect(showingState!.timer!.resumedAt).toBeNull();

        // Player answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify we're in ANSWERING state
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);

        // Wait for answer result event from timer expiration
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[1], // Listen on second player
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Expire the answering timer
        await testUtils.expireTimerAndWaitForAction(
          gameId,
          GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED
        );

        const answerResult = await answerResultPromise;

        // Timer should be restored with resumedAt set
        expect(answerResult.timer).toBeDefined();
        expect(answerResult.timer.resumedAt).toBeDefined();
        expect(answerResult.timer.resumedAt).not.toBeNull();

        // Verify game returned to SHOWING state
        const restoredState = await utils.getGameState(gameId);
        expect(restoredState!.questionState).toBe(QuestionState.SHOWING);
        expect(restoredState!.timer!.resumedAt).not.toBeNull();
      });
    });
  });

  describe("User joining mid-game with resumed timer", () => {
    it("should receive timer with resumedAt when joining after game unpause", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const gameDataAfterPause = await utils.getGameState(gameId);
        expect(gameDataAfterPause!.timer).toBeDefined();
        expect(gameDataAfterPause!.timer!.elapsedMs).toBeGreaterThanOrEqual(0);
        expect(gameDataAfterPause!.timer!.resumedAt).toBeNull();

        // Pause and unpause to set resumedAt
        await utils.pauseGame(showmanSocket);
        const unpausePromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.GAME_UNPAUSE
        );
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE, {});
        await unpausePromise;

        // New player joins
        const { socket: newPlayerSocket } = await utils.createGameClient(app, userRepo);
        const gameData = await utils.joinSpecificGameWithData(
          newPlayerSocket,
          gameId,
          PlayerRole.PLAYER
        );

        // Verify new player receives game state with resumedAt
        expect(gameData.gameState.timer).toBeDefined();
        expect(gameData.gameState.timer!.resumedAt).not.toBeNull();
      });
    });
  });
});
