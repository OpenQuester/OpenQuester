import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameActionType } from "domain/enums/GameActionType";
import type { PlayerReadinessBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { User } from "infrastructure/database/models/User";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/** Rules the host picks when creating a game: timers and the wrong-answer penalty */
describe("Game settings", () => {
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

  it.each([true, false])("honors autoStart=%s when everyone is ready", async (autoStart) => {
    await suite.scenario(async (scenario) => {
      utils.gameSettings = { ...INSTANT_BUZZER_SETTINGS, autoStart };
      const { gameId, showmanSocket, playerSockets, spectatorSockets } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
      const actors = [showmanSocket, ...playerSockets, ...spectatorSockets].map((socket) =>
        scenario.actor(socket)
      );
      const after = scenario.mark();
      const accepted = scenario
        .createAcceptedActionProbe({ gameId, actionType: GameActionType.PLAYER_READY })
        .waitForCount(2);
      const started = autoStart
        ? scenario.waitForEvent(showmanSocket, SocketIOGameEvents.START)
        : null;
      await utils.setPlayerReady(playerSockets[0]);
      const finalReady = scenario.waitForEvent<PlayerReadinessBroadcastData>(
        showmanSocket,
        SocketIOGameEvents.PLAYER_READY
      );
      await utils.setPlayerReady(playerSockets[1]);
      const ready = await finalReady;
      await accepted;
      await scenario.assert.waitForActionsComplete({ gameId });
      expect(ready.autoStartTriggered).toBe(autoStart);
      expect((await utils.getGameFromGameService(gameId)).settings.autoStart).toBe(autoStart);
      if (autoStart) {
        await started;
      } else {
        await scenario.assert.noInboundMany({
          actors,
          event: SocketIOGameEvents.START,
          afterSequence: after,
          durationMs: 100
        });
        expect((await utils.getGameState(gameId))?.currentRound).toBeNull();
        await utils.startGame(showmanSocket);
      }
      expect((await utils.getGameState(gameId))?.currentRound?.order).toBe(0);
    });
  });

  it("uses the host's answer time and free wrong answers", async () => {
    await suite.scenario(async (scenario) => {
      utils.gameSettings = {
        falseStart: false,
        buttonPressMode: ButtonPressMode.FIRST_WINS,
        wrongAnswerPenalty: WrongAnswerPenalty.NONE,
        timers: { answerSubmitMs: 7_000 }
      };
      const { showmanSocket, playerSockets, gameId, playerUsers } =
        await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
      await utils.startGame(showmanSocket);
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

      const game = await utils.getGameFromGameService(gameId);
      expect(game.getPlayer(playerUsers[0].id, { fetchDisconnected: true })!.score).toBe(0);
      expect(game.settings.timers.answerSubmitMs).toBe(7_000);
    });
  });

  it("rejects timers outside the allowed range", async () => {
    await suite.scenario(async () => {
      const { cookie } = await utils.createGameClient(app, userRepo);
      const http = createHttpTestClient(suite.serverUrl);
      const res = await http
        .post("/v1/games")
        .set("Cookie", cookie)
        .send({
          title: "Too fast",
          packageId: 1,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 4,
          settings: { timers: { answerMs: 500 } }
        });
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });
});
