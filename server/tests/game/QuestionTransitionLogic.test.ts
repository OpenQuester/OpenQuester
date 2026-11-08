import { UnpauseGameUseCase } from "application/usecases/game/UnpauseGameUseCase";
import { GameService } from "application/services/game/GameService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { DataMutationType } from "domain/enums/DataMutationType";
import { TimerExpirationUseCase } from "application/usecases/timer/TimerExpirationUseCase";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { GameActionType } from "domain/enums/GameActionType";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import {
  QUESTION_CONTENT_START_LEAD_MS,
  MEDIA_PLAYBACK_START_DELAY_MS
} from "domain/constants/game";
import { questionTransitionTimerKey } from "domain/constants/redisKeys";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";
import { MediaDownloadingToShowingHandler } from "domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  TestLogger,
  buildGame
} from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

beforeEach(() => {
  jest.useFakeTimers({ now: 10_000 });
});
afterEach(() => {
  jest.useRealTimers();
});

function prepare(media = true, solo = false) {
  const game = buildGame("OPEN", null);
  game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
  if (solo) for (const p of game.getInGamePlayers()) game.removePlayer(p.meta.id);
  game.captureQuestionEligiblePlayers();
  for (const p of game.players) p.mediaDownloaded = false;
  game.gameState.currentQuestion!.questionFiles = media
    ? [
        {
          order: 0,
          displayTime: null,
          file: { md5: "clip", type: PackageFileType.VIDEO }
        }
      ]
    : [];
  QuestionTransitionLogic.start(game);
  return game;
}

function ready(game: ReturnType<typeof prepare>) {
  for (const p of game.players) if (p.role === PlayerRole.PLAYER) p.mediaDownloaded = true;
  return QuestionTransitionLogic.refresh(game);
}

describe("server question opening barrier", () => {
  it("waits exactly 1550ms for warm media, then keeps only the 200ms delivery lead", async () => {
    const game = prepare();
    ready(game);
    jest.advanceTimersByTime(1549);
    expect(QuestionTransitionLogic.canShow(game)).toBe(false);
    jest.advanceTimersByTime(1);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
    const result = await new MediaDownloadingToShowingHandler().execute({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { isSystem: true }
    });
    expect(new Date(result.timer!.startedAt).getTime()).toBe(
      Date.now() + QUESTION_CONTENT_START_LEAD_MS
    );
    expect(result.timerMutations).toContainEqual({
      op: "delete",
      key: questionTransitionTimerKey(game.id)
    });
    expect(game.gameState.questionTransition).toBeNull();
  });

  it("never treats opening expiration as forced media readiness", () => {
    const game = prepare();
    jest.advanceTimersByTime(1550);
    const ctx = { game, trigger: TransitionTrigger.TIMER_EXPIRED, triggeredBy: { isSystem: true } };
    expect(new MediaDownloadingToShowingHandler().canTransition(ctx)).toBe(false);
    expect(game.players.every((p) => !p.mediaDownloaded)).toBe(true);
  });

  it("keeps a 300ms closing fade after slow readiness and ignores duplicate readiness", () => {
    const game = prepare();
    jest.advanceTimersByTime(2000);
    expect(ready(game)).toHaveLength(1);
    expect(game.gameState.questionTransition!.timer.durationMs).toBe(2300);
    jest.advanceTimersByTime(100);
    expect(ready(game)).toEqual([]);
    expect(game.gameState.questionTransition!.timer.durationMs).toBe(2300);
    jest.advanceTimersByTime(200);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
  });

  it("uses only the opening clock for text and requires no readiness command", () => {
    const game = prepare(false);
    expect(game.gameState.timer).toBeNull();
    expect(game.gameState.questionTransition!.mediaReady).toBe(true);
    jest.advanceTimersByTime(1550);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
    expect(game.players.every((p) => !p.mediaDownloaded)).toBe(true);
  });

  it("waits for the solo showman, while a spectator cannot release media", () => {
    const game = prepare(true, true);
    jest.advanceTimersByTime(1550);
    expect(QuestionTransitionLogic.canShow(game)).toBe(false);
    game.players.find((p) => p.role === PlayerRole.SHOWMAN)!.mediaDownloaded = true;
    ready(game);
    jest.advanceTimersByTime(300);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
  });

  it("forces media only for its timeout and still preserves the final fade", () => {
    const game = prepare();
    jest.advanceTimersByTime(30_000);
    QuestionTransitionLogic.refresh(game, true);
    expect(QuestionTransitionLogic.canShow(game)).toBe(false);
    jest.advanceTimersByTime(300);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
  });

  it("keeps the timeout fallback ready through reconnect during the closing fade", () => {
    const game = prepare();
    jest.advanceTimersByTime(30_000);
    QuestionTransitionLogic.refresh(game, true);
    game.getInGamePlayers()[0].mediaDownloaded = false;
    QuestionTransitionLogic.refresh(game);
    expect(game.gameState.questionTransition?.timedOut).toBe(true);
    jest.advanceTimersByTime(300);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
  });

  it("freezes the opening and accepts readiness while paused without running its key", () => {
    const game = prepare();
    const service = new SocketGameTimerService();
    jest.advanceTimersByTime(1400);
    const paused = service.buildPauseTimerMutations(game, null);
    expect(paused.timerMutations).toContainEqual({
      op: "delete",
      key: questionTransitionTimerKey(game.id)
    });
    jest.advanceTimersByTime(10_000);
    expect(ready(game)).toEqual([]);
    expect(game.gameState.questionTransition!.timer.durationMs).toBe(1700);
    expect(QuestionTransitionLogic.canShow(game)).toBe(false);
    const resumed = service.buildUnpauseTimerMutations(game, null);
    expect(resumed.timerMutations).toContainEqual(
      expect.objectContaining({
        op: "set",
        key: questionTransitionTimerKey(game.id),
        pxTtl: 300
      })
    );
    jest.advanceTimersByTime(300);
    expect(QuestionTransitionLogic.canShow(game)).toBe(true);
  });

  it("revokes readiness for a reconnecting captured viewer and clears state on exit", () => {
    const game = prepare();
    ready(game);
    game.getInGamePlayers()[0].mediaDownloaded = false;
    QuestionTransitionLogic.refresh(game);
    jest.advanceTimersByTime(1600);
    expect(QuestionTransitionLogic.canShow(game)).toBe(false);
    ready(game);
    expect(game.gameState.questionTransition!.timer.durationMs).toBe(1900);
    game.resetToChoosingState();
    expect(game.gameState.questionTransition).toBeNull();
  });

  it("retains the old timer lead for an active question without opening metadata", async () => {
    const game = prepare();
    game.gameState.questionTransition = null;
    ready(game);
    const result = await new MediaDownloadingToShowingHandler().execute({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { isSystem: true }
    });
    expect(new Date(result.timer!.startedAt).getTime()).toBe(
      Date.now() + MEDIA_PLAYBACK_START_DELAY_MS
    );
  });
});

describe("queued opening expiration guards", () => {
  it.each(["replacement", "paused", "new-question", "future-deadline"])(
    "guards %s",
    async (kind) => {
      const game = prepare(false);
      const handleMedia = jest.fn(async () => ({ success: true, broadcasts: [] }));
      const useCase = new TimerExpirationUseCase(
        { handleMediaDownloadExpiration: handleMedia } as unknown as TimerExpirationService,
        new TestLogger()
      );
      const ctx: ActionExecutionContext<TimerActionPayload> = {
        game,
        currentPlayer: null,
        timer: null,
        lockToken: "lock",
        userData: null,
        questionTransitionTimer:
          kind === "replacement" ? game.gameState.questionTransition!.timer : null,
        action: {
          id: "expiration",
          gameId: game.id,
          playerId: -1,
          socketId: "system",
          type: GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED,
          timestamp: new Date(),
          payload: {
            timerKey: questionTransitionTimerKey(game.id),
            questionState: QuestionState.MEDIA_DOWNLOADING,
            expirationTime: new Date(kind === "new-question" ? Date.now() - 1 : Date.now())
          }
        }
      };
      if (kind === "paused") game.pause();
      const result = await useCase.execute(ctx);
      expect(handleMedia).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.mutations).toHaveLength(kind === "future-deadline" ? 1 : 0);
    }
  );
});

it("resumes readiness received during a legacy question's pause without waiting for its media timeout", async () => {
  const game = prepare();
  game.gameState.questionTransition = null;
  ready(game);
  game.pause();
  const logger = new TestLogger();
  const saved = { startedAt: new Date(), durationMs: 30_000, elapsedMs: 100, resumedAt: null };
  const useCase = new UnpauseGameUseCase(
    new SocketGameTimerService(),
    { getTimer: async () => saved } as unknown as GameService,
    { validateShowmanOrModerator: async () => undefined } as unknown as SocketGameValidationService,
    new PhaseTransitionRouter(logger, [new MediaDownloadingToShowingHandler()])
  );
  const result = await useCase.execute({
    game,
    currentPlayer: null,
    timer: null,
    lockToken: "lock",
    userData: null,
    action: {
      id: "resume",
      gameId: game.id,
      playerId: 1,
      socketId: "host",
      type: GameActionType.UNPAUSE,
      timestamp: new Date(),
      payload: {}
    }
  });
  expect(game.gameState.questionState).toBe(QuestionState.SHOWING);
  expect(result.mutations).toContainEqual(
    expect.objectContaining({
      type: DataMutationType.BROADCAST,
      event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
      data: expect.objectContaining({ allPlayersReady: true, timer: game.gameState.timer })
    })
  );
});
