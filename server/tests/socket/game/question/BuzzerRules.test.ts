import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { Repository } from "typeorm";

import { BUZZER_FALSE_START_LOCK_TIME } from "domain/constants/game";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { DEFAULT_GAME_SETTINGS } from "domain/constants/gameSettings";
import { ButtonPressMode } from "domain/types/dto/game/settings/GameSettingsDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BuzzerFalseStartEventPayload } from "domain/types/socket/events/game/BuzzerFalseStartEventPayload";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { User } from "infrastructure/database/models/User";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { INSTANT_BUZZER_SETTINGS } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

/**
 * Buzzer fairness (SIGame parity): false starts lock a player out, and presses
 * that arrive close together are drawn at random instead of by arrival.
 */
describe("Buzzer rules", () => {
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

  describe("false start", () => {
    it("locks a player who presses before the buzzer opens", async () => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = DEFAULT_GAME_SETTINGS;
        const { showmanSocket, playerSockets, gameId, playerUsers } =
          await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const opensAt = (await utils.getGameState(gameId))!.buzzerOpensAtMs ?? 0;
        expect(opensAt).toBeGreaterThan(0);

        const falseStart = await scenario.emitAndWaitForEvent<BuzzerFalseStartEventPayload>(
          showmanSocket,
          SocketIOGameEvents.BUZZER_FALSE_START,
          () => scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER)
        );
        expect(falseStart).toEqual({
          playerId: playerUsers[0].id,
          lockMs: BUZZER_FALSE_START_LOCK_TIME
        });

        const state = await utils.getGameState(gameId);
        expect(state!.questionState).toBe(QuestionState.SHOWING);
        expect(state!.answeringPlayer).toBeNull();
        expect(state!.buzzerLocks?.[String(playerUsers[0].id)]).toBeGreaterThan(Date.now());

        // A second press inside the lock is rejected
        const error = await scenario.emitAndWaitForEvent<{ message: string }>(
          playerSockets[0],
          SocketIOEvents.ERROR,
          () => scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER)
        );
        expect(error.message).toBeTruthy();
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.SHOWING);
      });
    });

    it("lets players press once the caption has been read", async () => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = {
          falseStart: true,
          buttonPressMode: ButtonPressMode.FIRST_WINS
        };
        const { showmanSocket, playerSockets, gameId, playerUsers } =
          await utils.setupGameTestEnvironment(userRepo, app, 1, 0);

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const opensAt = (await utils.getGameState(gameId))!.buzzerOpensAtMs ?? 0;
        // Nothing happens while the caption is read
        await scenario.waitForNoEvent(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER,
          opensAt + 100
        );

        const answer = await scenario.emitAndWaitForEvent<QuestionAnswerEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER,
          () => scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER)
        );
        expect(answer.userId).toBe(playerUsers[0].id);
      });
    });
  });

  describe("accept window", () => {
    it("draws the answerer among players who pressed close together", async () => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = {
          falseStart: false,
          buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW
        };
        const { showmanSocket, playerSockets, gameId, playerUsers } =
          await utils.setupGameTestEnvironment(userRepo, app, 3, 0);

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const answerPromise = scenario.waitForEvent<QuestionAnswerEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER
        );
        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER);
        scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_ANSWER);

        const answer = await answerPromise;
        expect([playerUsers[0].id, playerUsers[1].id]).toContain(answer.userId);

        const state = await utils.getGameState(gameId);
        expect(state!.questionState).toBe(QuestionState.ANSWERING);
        expect(state!.answeringPlayer).toBe(answer.userId);
        expect(state!.buzzerWindow).toBeNull();
      });
    });

    it("gives a lone press the answer once the window closes", async () => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = {
          falseStart: false,
          buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW
        };
        const { showmanSocket, playerSockets, gameId, playerUsers } =
          await utils.setupGameTestEnvironment(userRepo, app, 2, 0);

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        const answer = await scenario.emitAndWaitForEvent<QuestionAnswerEventPayload>(
          showmanSocket,
          SocketIOGameEvents.QUESTION_ANSWER,
          () => scenario.actor(playerSockets[1]).emit(SocketIOGameEvents.QUESTION_ANSWER)
        );
        expect(answer.userId).toBe(playerUsers[1].id);
        expect((await utils.getGameState(gameId))!.questionState).toBe(QuestionState.ANSWERING);
      });
    });

    it("drops pending presses when the showman pauses", async () => {
      await suite.scenario(async (scenario) => {
        utils.gameSettings = {
          falseStart: false,
          buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW
        };
        const { showmanSocket, playerSockets, gameId } = await utils.setupGameTestEnvironment(
          userRepo,
          app,
          2,
          0
        );

        await utils.startGame(showmanSocket);
        await utils.pickQuestion(showmanSocket, undefined, playerSockets);

        scenario.actor(playerSockets[0]).emit(SocketIOGameEvents.QUESTION_ANSWER);
        await utils.pauseGame(showmanSocket);

        await scenario.waitForNoEvent(showmanSocket, SocketIOGameEvents.QUESTION_ANSWER, 600);
        const state = await utils.getGameState(gameId);
        expect(state!.questionState).toBe(QuestionState.SHOWING);
        expect(state!.buzzerWindow).toBeNull();
      });
    });
  });
});
