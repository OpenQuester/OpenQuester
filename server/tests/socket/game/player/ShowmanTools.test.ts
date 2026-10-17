import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  AnswerResultUndoEventPayload,
  QuestionRemoveRestoreEventPayload
} from "domain/types/socket/events/game/ShowmanToolsEventPayloads";
import { GameJoinInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/** Board and ruling corrections, and opening/closing the game to newcomers */
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
          await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
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

        // Nothing left to undo
        await scenario.emitAndWaitForEvent(showmanSocket, SocketIOEvents.ERROR, () =>
          scenario.actor(showmanSocket).emit(SocketIOGameEvents.ANSWER_RESULT_UNDO)
        );

        // The player may buzz again
        await utils.answerQuestion(playerSockets[0], showmanSocket);
      });
    }
  );

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
          scenario
            .actor(showmanSocket)
            .emit(SocketIOGameEvents.GAME_JOIN_MODE_CHANGE, {
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
});
