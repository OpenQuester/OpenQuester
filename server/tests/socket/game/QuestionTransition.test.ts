import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { QUESTION_TRANSITION_MS, SYSTEM_PLAYER_ID } from "domain/constants/game";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { GamePauseBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "shared/config/RedisConfig";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

const entryWaitMs = QUESTION_TRANSITION_MS + TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS;

describe("Question transition Redis barrier", () => {
  let suite: SocketGameTestSuite;
  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
  });
  afterEach(async () => {
    await suite?.reset();
  });
  afterAll(async () => {
    await suite?.stop();
  });

  async function pick(scenario: GameScenario, media: boolean, players = 2) {
    const setup = await suite.utils.setupGameTestEnvironment(
      suite.userRepo,
      suite.app,
      players,
      0,
      false,
      0,
      media
    );
    await suite.utils.startGame(setup.showmanSocket);
    const questionId = await suite.utils.getFirstAvailableQuestionId(setup.gameId);
    const data = scenario.waitForEvent<GameQuestionDataEventPayload>(
      setup.showmanSocket,
      SocketIOGameEvents.QUESTION_DATA
    );
    const accepted = suite.utils.waitForSubmittedActions(
      setup.gameId,
      1,
      GameActionType.QUESTION_PICK
    );
    scenario.actor(setup.showmanSocket).emit(SocketIOGameEvents.QUESTION_PICK, { questionId });
    const [payload] = await Promise.all([data, accepted]);
    await suite.utils.waitForActionsComplete(setup.gameId);
    expect((await suite.utils.getGameState(setup.gameId))?.questionState).toBe(
      QuestionState.MEDIA_DOWNLOADING
    );
    expect(payload.questionTransition?.timer.durationMs).toBe(1550);
    expect(
      await RedisConfig.getClient().pttl(questionTransitionTimerKey(setup.gameId))
    ).toBeGreaterThan(0);
    return { ...setup, payload };
  }

  it("releases a text question by Redis timer without any client media ACK", async () => {
    await suite.scenario(async (scenario) => {
      const game = await pick(scenario, false);
      expect(game.payload.timer).toBeNull();
      expect(await RedisConfig.getClient().exists(timerKey(game.gameId))).toBe(0);
      const ready = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (status) => status.timer != null,
        entryWaitMs
      );
      const status = await ready;
      await suite.utils.waitForActionsComplete(game.gameId);
      expect(status.playerId).toBe(SYSTEM_PLAYER_ID);
      expect(status.questionTransition).toBeNull();
      expect((await suite.utils.getGameState(game.gameId))?.questionState).toBe(
        QuestionState.SHOWING
      );
      expect(new Date(status.timer!.startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(game.payload.questionTransition!.timer.startedAt).getTime() + 1750
      );
      expect(await RedisConfig.getClient().exists(questionTransitionTimerKey(game.gameId))).toBe(0);
    });
  });

  it("keeps ready clients in preparation and gives both clients the same question clock", async () => {
    await suite.scenario(async (scenario) => {
      const game = await pick(scenario, true);
      const released = game.playerSockets.map((socket) =>
        scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
          socket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          (s) => s.timer != null,
          entryWaitMs
        )
      );
      for (const [index, socket] of game.playerSockets.entries()) {
        const receipt = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
          game.showmanSocket,
          SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          (s) => s.playerId === game.playerUsers[index].id
        );
        const accepted = suite.utils.waitForSubmittedActions(
          game.gameId,
          1,
          GameActionType.MEDIA_DOWNLOADED
        );
        scenario.actor(socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
        const [status] = await Promise.all([receipt, accepted]);
        expect(status.timer).toBeNull();
        expect(status.allPlayersReady).toBe(index === game.playerSockets.length - 1);
        await suite.utils.waitForActionsComplete(game.gameId);
        expect((await suite.utils.getGameState(game.gameId))?.questionState).toBe(
          QuestionState.MEDIA_DOWNLOADING
        );
      }
      const statuses = await Promise.all(released);
      expect(statuses[0].timer).toEqual(statuses[1].timer);
      expect(new Date(statuses[0].timer!.startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(game.payload.questionTransition!.timer.startedAt).getTime() + 1750
      );
    });
  });

  it("does not force readiness when the transition timer expires before the last ACK", async () => {
    await suite.scenario(async (scenario) => {
      const game = await pick(scenario, true, 1);
      await suite.testUtils.expireTimerAndWaitForAction(
        game.gameId,
        GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED,
        "question-transition"
      );
      await suite.utils.waitForActionsComplete(game.gameId);
      const before = await suite.utils.getGameState(game.gameId);
      expect(before?.questionTransition?.mediaReady).toBe(false);
      expect(before?.questionState).toBe(QuestionState.MEDIA_DOWNLOADING);
      const released = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (s) => s.timer != null
      );
      const receipt = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (s) => s.playerId === game.playerUsers[0].id
      );
      const accepted = suite.utils.waitForSubmittedActions(
        game.gameId,
        1,
        GameActionType.MEDIA_DOWNLOADED
      );
      const beforeAck = Date.now();
      scenario.actor(game.playerSockets[0]).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
      const [status] = await Promise.all([receipt, accepted]);
      expect(status.timer).toBeNull();
      expect(status.questionTransition?.mediaReady).toBe(true);
      const showing = await released;
      expect(new Date(showing.timer!.startedAt).getTime()).toBeGreaterThanOrEqual(beforeAck + 500);
    });
  });

  it("freezes a text transition and resumes its remaining Redis deadline", async () => {
    await suite.scenario(async (scenario) => {
      const game = await pick(scenario, false);
      const paused = scenario.waitForEvent<GamePauseBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.GAME_PAUSE
      );
      scenario.actor(game.showmanSocket).emit(SocketIOGameEvents.GAME_PAUSE);
      const pause = await paused;
      await suite.utils.waitForActionsComplete(game.gameId);
      expect(pause.timer).toBeNull();
      expect(pause.questionTransition?.timer.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(await RedisConfig.getClient().exists(questionTransitionTimerKey(game.gameId))).toBe(0);
      const resumed = scenario.waitForEvent<GamePauseBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.GAME_UNPAUSE
      );
      const released = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (s) => s.timer != null,
        entryWaitMs
      );
      scenario.actor(game.showmanSocket).emit(SocketIOGameEvents.GAME_UNPAUSE);
      const unpause = await resumed;
      expect(unpause.questionTransition?.timer.elapsedMs).toBe(
        pause.questionTransition?.timer.elapsedMs
      );
      expect(unpause.questionTransition?.timer.resumedAt).toBeTruthy();
      await released;
    });
  });

  it("keeps the solo showman as loader when a player joins during preparation", async () => {
    await suite.scenario(async (scenario) => {
      const game = await pick(scenario, true, 0);
      expect(game.payload.questionTransition?.mediaEligiblePlayerIds).toEqual([]);
      const late = await suite.utils.createGameClient(suite.app, suite.userRepo);
      await suite.utils.joinGame(late.socket, game.gameId, PlayerRole.PLAYER);
      const ignored = suite.utils.waitForSubmittedActions(
        game.gameId,
        1,
        GameActionType.MEDIA_DOWNLOADED
      );
      scenario.actor(late.socket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
      await ignored;
      await suite.utils.waitForActionsComplete(game.gameId);
      expect((await suite.utils.getGameState(game.gameId))?.questionTransition?.mediaReady).toBe(
        false
      );
      const ready = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (s) => s.playerId === game.showmanUser.id
      );
      scenario.actor(game.showmanSocket).emit(SocketIOGameEvents.MEDIA_DOWNLOADED);
      expect(await ready).toMatchObject({ allPlayersReady: true, timer: null });
      await suite.utils.waitForActionsComplete(game.gameId);
      const released = scenario.waitForEventMatching<MediaDownloadStatusBroadcastData>(
        game.showmanSocket,
        SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        (s) => s.timer != null
      );
      await suite.testUtils.expireTimer(game.gameId, "question-transition");
      await released;
      expect((await suite.utils.getGameState(game.gameId))?.questionState).toBe(
        QuestionState.SHOWING
      );
    });
  });

  it("keeps existing pickQuestion callers ready to act without synthetic text ACKs", async () => {
    await suite.scenario(async () => {
      const game = await suite.utils.setupGameTestEnvironment(
        suite.userRepo,
        suite.app,
        2,
        0,
        false
      );
      await suite.utils.startGame(game.showmanSocket);
      await suite.utils.pickQuestion(game.showmanSocket, undefined, game.playerSockets);
      expect((await suite.utils.getGameState(game.gameId))?.questionState).toBe(
        QuestionState.SHOWING
      );
    });
  });
});
