import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { DEFAULT_GAME_TIMERS } from "domain/constants/gameSettings";
import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  AnswerResultUndoEventPayload,
  GameSettingsChangeEventPayload,
  QuestionRemoveRestoreEventPayload
} from "domain/types/socket/events/game/ShowmanToolsEventPayloads";
import { GameJoinInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { container } from "tsyringe";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/** Board and ruling corrections, game rules, and opening/closing the game to newcomers */
describe("Showman tools", () => {
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
    utils.gameSettings = INSTANT_BUZZER_SETTINGS;
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  it("removes a question from the board and puts it back", async () => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      await utils.startGame(showmanSocket);
      const questionId = (await utils.getGameState(gameId))!.currentRound!.themes[0].questions[0]
        .id!;

      const removed = await scenario.emitAndWaitForEvent<QuestionRemoveRestoreEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.QUESTION_REMOVE_RESTORE,
        () =>
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.QUESTION_REMOVE_RESTORE, { questionId })
      );
      expect(removed).toEqual({ questionId, isPlayed: true });

      // A removed question can't be picked
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
      );

      const restored = await scenario.emitAndWaitForEvent<QuestionRemoveRestoreEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_REMOVE_RESTORE,
        () =>
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.QUESTION_REMOVE_RESTORE, { questionId })
      );
      expect(restored.isPlayed).toBe(false);

      // Only the showman may do this
      await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOEvents.ERROR, () =>
        scenario
          .actor(playerSockets[0])
          .emit(SocketIOGameEvents.QUESTION_REMOVE_RESTORE, { questionId })
      );
    });
  });

  it.each([
    { penalty: WrongAnswerPenalty.SUBTRACT, expectedScoreChange: -100 },
    { penalty: WrongAnswerPenalty.NONE, expectedScoreChange: 0 }
  ])(
    "takes back a wrong ruling with $penalty penalty and restores buzzer eligibility",
    async ({ penalty, expectedScoreChange }) => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = { ...INSTANT_BUZZER_SETTINGS, wrongAnswerPenalty: penalty };

        const { showmanSocket, playerSockets, gameId, playerUsers } =
          await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        await utils.answerQuestion(playerSockets[0], showmanSocket);

        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            answerType: AnswerResultType.WRONG,
            scoreResult: -100
          })
        );

        const undo = await scenario.emitAndWaitForEvent<AnswerResultUndoEventPayload>(
          playerSockets[1],
          SocketIOGameEvents.ANSWER_RESULT_UNDO,
          () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
        );
        expect(undo).toEqual({
          playerId: playerUsers[0].id,
          revertedResult: expectedScoreChange,
          newScore: 0,
          canAnswerAgain: true
        });

        const state = await utils.getGameState(gameId);
        expect(state!.questionState).toBe(QuestionState.SHOWING);
        expect(state!.answeredPlayers ?? []).toHaveLength(0);

        // Statistics forget the answer that was taken back
        const stats = await container
          .resolve(PlayerGameStatsRepository)
          .getStats(gameId, playerUsers[0].id);
        expect(stats).toMatchObject({
          questionsAnswered: "0",
          wrongAnswers: "0",
          currentScore: "0"
        });

        // Nothing left to undo
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
        );

        // The player may buzz again
        await utils.answerQuestion(playerSockets[0], showmanSocket);
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            answerType: AnswerResultType.CORRECT,
            scoreResult: 100
          })
        );
        await utils.progressToNextRound(showmanSocket);
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.GAME_FINISHED, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.NEXT_ROUND, {})
        );
        await scenario.assert.waitForActionsComplete({ gameId });
        expect(
          await suite.dataSource
            .getRepository(PlayerGameStats)
            .findOneByOrFail({ user_id: playerUsers[0].id })
        ).toMatchObject({
          final_score: 100,
          questions_answered: 1,
          correct_answers: 1,
          wrong_answers: 0
        });
      });
    }
  );

  it.each([
    { answerType: AnswerResultType.CORRECT, scoreResult: 100 },
    { answerType: AnswerResultType.WRONG, scoreResult: -100 },
    { answerType: AnswerResultType.SKIP, scoreResult: 0 }
  ])("does not persist an undone $answerType ruling when the game finishes", async (ruling) => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);
      await utils.answerQuestion(playerSockets[0], showmanSocket);
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, ruling)
      );
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT_UNDO, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
      );
      expect(
        await container.resolve(PlayerGameStatsRepository).getStats(gameId, playerUsers[0].id)
      ).toMatchObject({
        currentScore: "0",
        questionsAnswered: "0",
        correctAnswers: "0",
        wrongAnswers: "0"
      });
      await utils.progressToNextRound(showmanSocket);
      await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.GAME_FINISHED, () =>
        scenario.actor(showmanSocket).emit(SocketIOGameEvents.NEXT_ROUND, {})
      );
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(
        await suite.dataSource
          .getRepository(PlayerGameStats)
          .findOneByOrFail({ user_id: playerUsers[0].id })
      ).toMatchObject({
        final_score: 0,
        questions_answered: 0,
        correct_answers: 0,
        wrong_answers: 0
      });
    });
  });

  it("undoes each exhausted player's ruling once during the answer reveal", async () => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, playerSockets, playerUsers, gameId } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0, false);
      await utils.startGame(showmanSocket);
      await utils.pickQuestion(showmanSocket, undefined, playerSockets);
      for (const socket of playerSockets) {
        await utils.answerQuestion(socket, showmanSocket);
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOGameEvents.ANSWER_RESULT, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            answerType: AnswerResultType.WRONG,
            scoreResult: -100
          })
        );
      }
      expect((await utils.getGameState(gameId))?.questionState).toBe(QuestionState.SHOWING_ANSWER);

      for (const player of [...playerUsers].reverse()) {
        const undo = await scenario.emitAndWaitForEvent<AnswerResultUndoEventPayload>(
          showmanSocket,
          SocketIOGameEvents.ANSWER_RESULT_UNDO,
          () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
        );
        expect(undo).toEqual({
          playerId: player.id,
          revertedResult: -100,
          newScore: 0,
          canAnswerAgain: false
        });
        expect(
          await container.resolve(PlayerGameStatsRepository).getStats(gameId, player.id)
        ).toMatchObject({ questionsAnswered: "0", wrongAnswers: "0", currentScore: "0" });
      }
      const repeated = await scenario.emitAndWaitForEvent<{ message: string }>(
        showmanSocket,
        SocketIOEvents.ERROR,
        () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
      );
      expect(repeated.message).toBe("There's no ruling on this question to undo");
    });
  });

  it("closes the game to newcomers, or opens it to spectators only", async () => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, gameId } = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

      await scenario.emitAndWaitForEvent(
        showmanSocket,
        SocketIOGameEvents.GAME_JOIN_MODE_CHANGE,
        () =>
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.GAME_JOIN_MODE_CHANGE, { joinMode: GameJoinMode.CLOSED })
      );
      const { socket: newcomer } = await utils.createGameClient(app, userRepo);
      const closed = await scenario.emitAndWaitForEvent<{ message: string }>(
        newcomer,
        SocketIOEvents.ERROR,
        () =>
          scenario.actor(newcomer).emit(SocketIOGameEvents.JOIN, {
            gameId,
            role: PlayerRole.SPECTATOR
          } as GameJoinInputData)
      );
      expect(closed.message).toBe("The showman closed this game to new people");

      await scenario.emitAndWaitForEvent(
        showmanSocket,
        SocketIOGameEvents.GAME_JOIN_MODE_CHANGE,
        () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_JOIN_MODE_CHANGE, {
            joinMode: GameJoinMode.SPECTATORS_ONLY
          })
      );
      const { socket: player } = await utils.createGameClient(app, userRepo);
      await scenario.emitAndWaitForEvent(player, SocketIOEvents.ERROR, () =>
        scenario.actor(player).emit(SocketIOGameEvents.JOIN, {
          gameId,
          role: PlayerRole.PLAYER
        } as GameJoinInputData)
      );
      await utils.joinSpecificGame(player, gameId, PlayerRole.SPECTATOR);
    });
  });

  it("changes the rules mid-game from the next timer on", async () => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        2,
        0
      );
      await utils.startGame(showmanSocket);

      const changed = await scenario.emitAndWaitForEvent<GameSettingsChangeEventPayload>(
        playerSockets[0],
        SocketIOGameEvents.GAME_SETTINGS_CHANGE,
        () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.GAME_SETTINGS_CHANGE, {
            wrongAnswerPenalty: WrongAnswerPenalty.NONE,
            timers: { answerSubmitMs: 7_000 }
          })
      );
      // Rules that were not sent keep their value
      expect(changed.settings).toEqual({
        falseStart: false,
        buttonPressMode: ButtonPressMode.FIRST_WINS,
        wrongAnswerPenalty: WrongAnswerPenalty.NONE,
        timers: { ...DEFAULT_GAME_TIMERS, answerSubmitMs: 7_000 }
      });
      expect((await utils.getGameFromGameService(gameId)).settings).toEqual(changed.settings);

      await utils.pickQuestion(showmanSocket, undefined, playerSockets);
      const answer = await scenario.emitAndWaitForEvent<QuestionAnswerEventPayload>(
        showmanSocket,
        SocketIOGameEvents.QUESTION_ANSWER,
        () => scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER)
      );
      expect(answer.timer.durationMs).toBe(7_000);

      const result = await scenario.emitAndWaitForEvent<QuestionAnswerResultEventPayload>(
        showmanSocket,
        SocketIOGameEvents.ANSWER_RESULT,
        () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT, {
            answerType: AnswerResultType.WRONG,
            scoreResult: -100
          })
      );
      expect(result.answerResult.result).toBe(0);
    });
  });

  it("refuses rule changes from players and values outside the creation limits", async () => {
    await suite.scenario(async (scenario) => {
      const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
        userRepo,
        app,
        1,
        0
      );
      const refusals: [typeof showmanSocket, unknown][] = [
        [playerSockets[0], { falseStart: true }],
        [showmanSocket, { timers: { answerMs: 500 } }],
        [showmanSocket, { timers: { roundMs: 60_000 } }],
        [showmanSocket, { timers: {} }],
        [showmanSocket, {}]
      ];

      for (const [socket, payload] of refusals) {
        await scenario.emitAndWaitForEvent(socket, SocketIOEvents.ERROR, () =>
          scenario.actor(socket).emit(SocketIOGameEvents.GAME_SETTINGS_CHANGE, payload)
        );
      }

      const settings = (await utils.getGameFromGameService(gameId)).settings;
      expect(settings.falseStart).toBe(false);
      expect(settings.timers).toEqual(DEFAULT_GAME_TIMERS);
    });
  });
});
