import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { MINUTE_MS } from "domain/constants/time";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { User } from "infrastructure/database/models/User";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Round time limit", () => {
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

  it.each(["showman", "player"])(
    "ends the round when the %s picks after its time is up",
    (picker) =>
      suite.scenario(async (scenario) => {
        utils.gameSettings = {
          ...INSTANT_BUZZER_SETTINGS,
          timers: { ...INSTANT_BUZZER_SETTINGS.timers, roundMs: 5 * MINUTE_MS }
        };
        const { showmanSocket, playerSockets, playerUsers, gameId } =
          await utils.setupGameTestEnvironment(userRepo, app, 1, 0, false);
        await utils.startGame(showmanSocket);
        const questionId = await utils.getFirstAvailableQuestionId(gameId);

        // The round started six minutes ago
        const game = await utils.getGameFromGameService(gameId);
        const roundId = game.gameState.currentRound!.id;
        game.gameState.currentTurnPlayerId = playerUsers[0].id;
        game.gameState.roundStartedAt = Date.now() - 6 * MINUTE_MS;
        await utils.updateGame(game);

        // The late pick moves everyone to the next round instead of a question
        const socket = picker === "showman" ? showmanSocket : playerSockets[0];
        await scenario.emitAndWaitForEvent(playerSockets[0], SocketIOGameEvents.NEXT_ROUND, () =>
          scenario.actor(socket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
        );

        const nextState = await utils.getGameState(gameId);
        expect(nextState).toMatchObject({
          questionState: QuestionState.CHOOSING,
          currentQuestion: null
        });
        expect(nextState!.currentRound!.id).not.toBe(roundId);

        // The new round has its own clock: picking starts a question again
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING);
      })
  );
});
