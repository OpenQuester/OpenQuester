import { describe, expect, it, jest } from "@jest/globals";

import type { GameActionExecutor } from "application/executors/GameActionExecutor";
import { TimerExpirationHandler } from "application/handlers/TimerExpirationHandler";
import type { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import type { Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { parseTimerKey, TimerKeyType, type ParsedTimerKey } from "domain/utils/parseTimerKey";
import {
  buildGame,
  buildTimer,
  TestLogger
} from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const gameId = "TIMER";

it.each<[string, ParsedTimerKey]>([
  [timerKey(gameId), { type: TimerKeyType.ACTIVE, gameId }],
  [questionTransitionTimerKey(gameId), { type: TimerKeyType.QUESTION_TRANSITION, gameId }],
  ...[QuestionState.SHOWING, QuestionState.MEDIA_DOWNLOADING, "saved-close-regression"].map(
    (timerAdditional): [string, ParsedTimerKey] => [
      timerKey(gameId, timerAdditional),
      { type: TimerKeyType.SAVED, gameId, timerAdditional }
    ]
  )
])("parses timer key %s", (key, expected) => {
  expect(parseTimerKey(key)).toEqual(expected);
});

const invalidKeys = [
  "",
  "timer",
  "game:TIMER",
  "timer:",
  "timer::TIMER",
  "timer:showing:",
  "timer:showing:TIMER:extra"
];

it.each(invalidKeys)("rejects malformed timer key %j", (key) => {
  expect(parseTimerKey(key)).toBeNull();
});

function setup(game: Game) {
  const loadGame = jest.fn(async () => game);
  const submitAction = jest.fn(async () => undefined);
  const handler = new TimerExpirationHandler(
    { getGameEntity: loadGame } as unknown as GameService,
    { submitAction } as unknown as GameActionExecutor,
    new TestLogger()
  );
  return { handler, loadGame, submitAction };
}

describe("timer expiration routing", () => {
  it.each([timerKey(gameId, QuestionState.SHOWING), ...invalidKeys])(
    "ignores %j before loading game state",
    async (key) => {
      const { handler, loadGame, submitAction } = setup(buildGame(gameId, null));
      await handler.handle(key);
      expect(loadGame).not.toHaveBeenCalled();
      expect(submitAction).not.toHaveBeenCalled();
    }
  );

  it.each([TimerKeyType.ACTIVE, TimerKeyType.QUESTION_TRANSITION])(
    "queues a %s expiration with the original key",
    async (type) => {
      const game = buildGame(gameId, type === TimerKeyType.ACTIVE ? buildTimer() : null);
      game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
      game.gameState.questionTransition = { timer: buildTimer(), mediaReady: false };
      const key =
        type === TimerKeyType.ACTIVE ? timerKey(gameId) : questionTransitionTimerKey(gameId);
      const { handler, loadGame, submitAction } = setup(game);

      await handler.handle(key);

      expect(loadGame).toHaveBeenCalledWith(gameId, GAME_TTL_IN_SECONDS);
      expect(submitAction).toHaveBeenCalledTimes(1);
      expect(submitAction).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId,
          type: GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED,
          payload: {
            timerKey: key,
            questionState: QuestionState.MEDIA_DOWNLOADING,
            expirationTime: expect.any(Date)
          }
        })
      );
    }
  );

  it.each(["paused", "missing-opening", "changed-phase", "missing-active-timer"])(
    "ignores an expiration with %s",
    async (reason) => {
      const game = buildGame(gameId, null);
      game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
      if (reason !== "missing-opening") {
        game.gameState.questionTransition = { timer: buildTimer(), mediaReady: false };
      }
      if (reason === "paused") {
        game.pause();
      }
      if (reason === "changed-phase") {
        game.gameState.questionState = QuestionState.SHOWING;
      }
      const key =
        reason === "missing-active-timer" ? timerKey(gameId) : questionTransitionTimerKey(gameId);
      const { handler, submitAction } = setup(game);

      await handler.handle(key);

      expect(submitAction).not.toHaveBeenCalled();
    }
  );
});
