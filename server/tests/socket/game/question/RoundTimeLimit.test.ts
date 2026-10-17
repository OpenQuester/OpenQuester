import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { MINUTE_MS } from "domain/constants/time";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
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

  it("refuses a new question once the round's time is up", () =>
    suite.scenario(async (scenario) => {
      utils.gameSettings = {
        ...INSTANT_BUZZER_SETTINGS,
        timers: { ...INSTANT_BUZZER_SETTINGS.timers, roundMs: 5 * MINUTE_MS }
      };
      const { showmanSocket, gameId } = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      await utils.startGame(showmanSocket);
      const questionId = await utils.getFirstAvailableQuestionId(gameId);

      // The round started six minutes ago
      const game = await utils.getGameFromGameService(gameId);
      game.gameState.roundStartedAt = Date.now() - 6 * MINUTE_MS;
      await utils.updateGame(game);

      const error = await scenario.emitAndWaitForEvent<{ message: string }>(
        showmanSocket,
        SocketIOEvents.ERROR,
        () => scenario.actor(showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId })
      );
      expect(error.message).toContain("time is up");
      expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.CHOOSING);
    }));
});
