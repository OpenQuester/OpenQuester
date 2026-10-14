import { describe, expect, it } from "@jest/globals";

import { MINUTE_MS } from "domain/constants/time";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import {
  DEFAULT_GAME_TIMERS,
  normalizeGameSettings,
  WrongAnswerPenalty
} from "domain/types/dto/game/settings/GameSettingsDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");

describe("game settings", () => {
  it("fills missing settings and timers with the defaults", () => {
    const settings = normalizeGameSettings({ timers: { answerMs: 10_000 } });
    expect(settings.falseStart).toBe(true);
    expect(settings.timers).toEqual({ ...DEFAULT_GAME_TIMERS, answerMs: 10_000 });
  });

  it("makes a wrong answer to a buzzer question free when the penalty is off", () => {
    const game = buildGame("RULE", null);
    game.settings = { ...game.settings, wrongAnswerPenalty: WrongAnswerPenalty.NONE };
    game.gameState.answeringPlayer = 2;
    const before = game.getPlayer(2, { fetchDisconnected: true })!.score;

    const result = game.handleQuestionAnswer(-100, AnswerResultType.WRONG, QuestionState.SHOWING);

    expect(result.result).toBe(0);
    expect(game.getPlayer(2, { fetchDisconnected: true })!.score).toBe(before);
  });

  it("still takes a stake on a wrong stake answer when the penalty is off", () => {
    const game = buildGame("RULE", null);
    game.settings = { ...game.settings, wrongAnswerPenalty: WrongAnswerPenalty.NONE };
    game.gameState.currentQuestion!.type = PackageQuestionType.STAKE;
    game.gameState.answeringPlayer = 2;

    expect(
      game.handleQuestionAnswer(-100, AnswerResultType.WRONG, QuestionState.SHOWING_ANSWER).result
    ).toBe(-100);
  });

  it("ends a round once its time limit has passed, not counting pauses", () => {
    const game = buildGame("RULE", null);
    game.settings = {
      ...game.settings,
      timers: { ...game.settings.timers, roundMs: 10 * MINUTE_MS }
    };
    game.gameState.roundStartedAt = NOW - 12 * MINUTE_MS;
    game.gameState.roundPausedMs = 3 * MINUTE_MS;

    expect(game.isRoundTimeUp(NOW)).toBe(false);
    expect(game.isRoundTimeUp(NOW + 2 * MINUTE_MS)).toBe(true);
  });

  it("has no round time limit by default", () => {
    const game = buildGame("RULE", null);
    game.gameState.roundStartedAt = NOW - 600 * MINUTE_MS;
    expect(game.isRoundTimeUp(NOW)).toBe(false);
  });
});
