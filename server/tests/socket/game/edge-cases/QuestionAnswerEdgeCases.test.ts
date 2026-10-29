import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";

/**
 * Edge case tests for question answer scenarios:
 * - Wrong answer when all players have skipped (auto-skip optimization)
 * - Picking non-existent question
 *
 * Note: Other edge cases are covered in:
 * - PlayerLeaveStateCleanup.test.ts (answering player disconnect/leave)
 * - SocketIOQuestionFlow.test.ts (picking already played question)
 */
describe("Question Answer Edge Cases", () => {
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
    if (utils) utils.packageTransform = null;
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("restores submitted text on rejoin before and after a manual ruling", async () => {
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

      const submitted = scenario.waitForEvent<{ answerText: string }>(
        showmanSocket,
        SocketIOGameEvents.ANSWER_SUBMITTED
      );
      const accepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_SUBMITTED })
        .waitForCount(1);
      scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "0" });
      await Promise.all([accepted, submitted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))?.submittedAnswer).toBe("0");

      const { socket: observer, user } = await utils.createGameClient(app, userRepo);
      const firstJoin = scenario.waitForEvent(observer, SocketIOGameEvents.GAME_DATA);
      scenario.actor(observer).emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await firstJoin).gameState.submittedAnswer).toBe("0");
      const leave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      scenario.actor(observer).disconnect();
      await leave;
      await scenario.assert.waitForActionsComplete({ gameId });
      const { socket: rejoined } = await utils.createSocketForExistingUser(app, user.id);
      const pendingJoin = scenario.waitForEvent(rejoined, SocketIOGameEvents.GAME_DATA);
      scenario.actor(rejoined).emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await pendingJoin).gameState.submittedAnswer).toBe("0");

      const resultEvent = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
        rejoined,
        SocketIOGameEvents.ANSWER_RESULT
      );
      const revealEvent = scenario.waitForEvent(rejoined, SocketIOGameEvents.QUESTION_FINISH);
      const judged = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_RESULT })
        .waitForCount(1);
      scenario
        .actor(showmanSocket)
        .emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.CORRECT,
          scoreResult: 0
        });
      const [, result, reveal] = await Promise.all([judged, resultEvent, revealEvent]);
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(result.answerResult.answerText).toBe("0");
      expect(reveal.answerResult.answerText).toBe("0");
      expect((await utils.getGameState(gameId))?.submittedAnswer).toBeNull();
      const secondLeave = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
      scenario.actor(rejoined).disconnect();
      await secondLeave;
      await scenario.assert.waitForActionsComplete({ gameId });
      const { socket: afterReveal } = await utils.createSocketForExistingUser(app, user.id);
      const revealJoin = scenario.waitForEvent(afterReveal, SocketIOGameEvents.GAME_DATA);
      scenario
        .actor(afterReveal)
        .emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      expect((await revealJoin).gameState.answerShowData.answerResult.answerText).toBe("0");
    });
  });

  it("keeps judged answer text after forced reveal, rejoin and undo", async () => {
    await suite.scenario(async (scenario) => {
      // Keep the reveal open long enough to join and undo, as a normal game can.
      utils.packageTransform = (pkg) => {
        for (const round of pkg.rounds) {
          for (const theme of round.themes) {
            for (const question of theme.questions) {
              question.showAnswerDuration = 30_000;
            }
          }
        }
      };
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        0
      );
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      const accepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.ANSWER_SUBMITTED })
        .waitForCount(1);
      const submitted = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_SUBMITTED);
      scenario
        .actor(playerSockets[0])
        .emit(SocketIOGameEvents.ANSWER_SUBMITTED, { answerText: "wrong but real" });
      await Promise.all([accepted, submitted]);
      await scenario.assert.waitForActionsComplete({ gameId });
      const ruled = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT);
      scenario
        .actor(showmanSocket)
        .emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });
      await ruled;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))?.questionState).toBe(QuestionState.SHOWING);
      const reveal = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.QUESTION_FINISH);
      const forced = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.SKIP_QUESTION_FORCE })
        .waitForCount(1);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.SKIP_QUESTION_FORCE, {});
      await forced;
      await reveal;
      await scenario.assert.waitForActionsComplete({ gameId });
      const { socket } = await utils.createGameClient(app, userRepo);
      const joined = scenario.waitForEvent(socket, SocketIOGameEvents.GAME_DATA);
      scenario.actor(socket).emit(SocketIOGameEvents.JOIN, { gameId, role: PlayerRole.SPECTATOR });
      const state = (await joined).gameState;
      expect(state.answeredPlayers.at(-1).answerText).toBe("wrong but real");
      const undone = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT_UNDO);
      scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO, {});
      await undone;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect((await utils.getGameState(gameId))?.answeredPlayers ?? []).toHaveLength(0);
      expect((await utils.getGameState(gameId))?.submittedAnswer ?? null).toBeNull();
    });
  });

  describe("Player Disconnect During SHOWING State", () => {
    it("should allow showman to process answer even after player disconnected (if not already processed)", async () => {
      await suite.scenario(async (scenario) => {
        // This test verifies the fix for fetchDisconnected: true
        // We need to test when player disconnects AFTER they are no longer answering
        // (e.g., during SHOWING phase after they got a wrong answer)
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player starts answering
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for answer result
        const answerResultPromise = scenario.waitForEvent<QuestionAnswerResultEventPayload>(
          playerSockets[1],
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Showman sends wrong answer result first (before disconnect)
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });

        await answerResultPromise;

        // Now player 0 disconnects (while in SHOWING state, not answering)
        const leavePromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.LEAVE);
        scenario.actor(playerSockets[0]).disconnect();
        await leavePromise;

        // Verify player is disconnected
        const game = await utils.getGameFromGameService(gameId);
        const player = game.getPlayer(playerUsers[0].id, {
          fetchDisconnected: true
        });
        expect(player?.gameStatus).toBe(PlayerGameStatus.DISCONNECTED);
        // Verify their score was updated (penalty applied)
        expect(player!.score).toBeLessThan(0);
      });
    });
  });

  describe("Wrong Answer When All Players Skipped", () => {
    it("should auto-skip question when wrong answer given and all other players skipped", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Players 2 and 3 skip the question
        const questionSkipPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await questionSkipPromise;

        const questionSkipPromise2 = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[2]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await questionSkipPromise2;

        // Verify 2 players have skipped
        const stateAfterSkips = await utils.getGameState(gameId);
        expect(stateAfterSkips!.skippedPlayers).toHaveLength(2);
        expect(stateAfterSkips!.skippedPlayers).toContain(playerUsers[1].id);
        expect(stateAfterSkips!.skippedPlayers).toContain(playerUsers[2].id);

        // Player 1 answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Verify player 1 is answering
        const answeringState = await utils.getGameState(gameId);
        expect(answeringState!.questionState).toBe(QuestionState.ANSWERING);
        expect(answeringState!.answeringPlayer).toBe(playerUsers[0].id);

        // Set up listeners for answer result AND question finish
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );

        const answerShowEndPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        // Showman sends wrong answer result
        // Since all other players have skipped, question should auto-skip
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });

        // Verify answer result and question finish were both received
        const answerResult = await answerResultPromise;
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(AnswerResultType.WRONG);
        // Timer should NOT be null since we now show answer even if everyone skipped
        expect(answerResult.timer).not.toBeNull();

        // Skip the show answer phase
        await utils.skipShowAnswer(showmanSocket);

        const questionFinish = await answerShowEndPromise;
        expect(questionFinish).toBeDefined();

        // Verify game went directly to CHOOSING state (skipped SHOWING)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
        expect(finalState!.timer).toBeNull();
        expect(finalState!.answeringPlayer).toBeNull();
        // Skipped players should be cleared after question finish
        expect(finalState!.skippedPlayers).toBeNull();
      });
    });

    it("should transition to SHOWING state when wrong answer given but players can still answer", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 3, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Only Player 2 skips (Player 3 can still answer)
        const questionSkipPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await questionSkipPromise;

        // Verify 1 player has skipped
        const stateAfterSkip = await utils.getGameState(gameId);
        expect(stateAfterSkip!.skippedPlayers).toHaveLength(1);
        expect(stateAfterSkip!.skippedPlayers).toContain(playerUsers[1].id);

        // Player 1 answers the question
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listener for answer result
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );

        // Showman sends wrong answer result
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });

        // Verify answer result received with timer (normal SHOWING transition)
        const answerResult = await answerResultPromise;
        expect(answerResult).toBeDefined();
        expect(answerResult.answerResult.answerType).toBe(AnswerResultType.WRONG);
        // Timer should be set since Player 3 can still answer
        expect(answerResult.timer).toBeDefined();

        // Verify game went to SHOWING state (normal flow)
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.SHOWING);
        expect(finalState!.timer).toBeDefined();
      });
    });

    it("should auto-skip when last answering player gets wrong and they were the only non-skipped", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId, playerUsers } = setup;

        // Start game and pick a question
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 2 skips
        const questionSkipPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_SKIP
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await questionSkipPromise;

        // Verify Player 2 skipped
        const stateAfterSkip = await utils.getGameState(gameId);
        expect(stateAfterSkip!.skippedPlayers).toContain(playerUsers[1].id);

        // Player 1 answers
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        // Set up listeners
        const answerResultPromise = scenario.waitForEvent(
          playerSockets[0],
          SocketIOGameEvents.ANSWER_RESULT
        );
        const questionFinishPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_END
        );

        // Showman sends wrong answer - should auto-skip since Player 2 already skipped
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });

        // Both events should be received
        const answerResult = await answerResultPromise;
        expect(answerResult.timer).not.toBeNull();

        await utils.skipShowAnswer(showmanSocket);

        await questionFinishPromise;

        // Should be in CHOOSING state, not SHOWING
        const finalState = await utils.getGameState(gameId);
        expect(finalState!.questionState).toBe(QuestionState.CHOOSING);
      });
    });
  });

  describe("Pass After Wrong Answer", () => {
    it("should finish the question when the last player passes after another answered wrong", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets, gameId } = setup;

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        // Player 1 answers wrong; the buzzer reopens for player 2
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        const reopenPromise = scenario.waitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT);
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerType: AnswerResultType.WRONG,
          scoreResult: -100
        });
        await reopenPromise;
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING);

        // Player 2 passes: nobody is left to buzz, so the answer is shown at once
        const finishPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_FINISH
        );
        const showStartPromise = scenario.waitForEvent(
          showmanSocket,
          SocketIOGameEvents.ANSWER_SHOW_START
        );
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_SKIP, {});
        await finishPromise;
        await showStartPromise;

        expect((await utils.getGameState(gameId))!.questionState).toBe(
          QuestionState.SHOWING_ANSWER
        );
      });
    });
  });

  describe("Question Pick Validation", () => {
    it("should reject picking non-existent question", async () => {
      await suite.scenario(async (scenario) => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { showmanSocket } = setup;

        // Start game
        await utils.startGame(showmanSocket);

        // Try to pick a non-existent question
        const nonExistentQuestionId = 999999;

        const nonExistentQuestionErrorPromise = scenario.waitForEvent<unknown>(
          showmanSocket,
          SocketIOEvents.ERROR
        );

        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, {
          questionId: nonExistentQuestionId
        });

        const nonExistentQuestionError = await nonExistentQuestionErrorPromise;
        const nonExistentQuestionErrorObj = nonExistentQuestionError as {
          message?: string;
        };
        expect(nonExistentQuestionErrorObj.message?.toLowerCase()).toContain("not found");
      });
    });
  });
});
