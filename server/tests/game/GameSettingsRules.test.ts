import { describe, expect, it } from "@jest/globals";

import { MINUTE_MS } from "domain/constants/time";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { DEFAULT_GAME_TIMERS } from "domain/constants/gameSettings";
import { GameSettingsLogic } from "domain/logic/game/GameSettingsLogic";
import { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { GameMapper } from "domain/mappers/GameMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";
import { PlayerReadinessLogic } from "domain/logic/game/PlayerReadinessLogic";
import { PlayerRoleChangeLogic } from "domain/logic/game/PlayerRoleChangeLogic";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");

describe("game settings", () => {
  it("fills missing settings and timers with the defaults", () => {
    const settings = GameSettingsLogic.normalize({ timers: { answerMs: 10_000 } });
    expect(settings.falseStart).toBe(true);
    expect(settings.autoStart).toBe(true);
    expect(settings.timers).toEqual({ ...DEFAULT_GAME_TIMERS, answerMs: 10_000 });
  });

  it("starts only in automatic mode when each connected player is ready", () => {
    const game = buildGame("MODE", null);
    const players = game.players.filter((p) => p.role === PlayerRole.PLAYER);
    expect(players.length).toBeGreaterThan(0);
    game.gameState.readyPlayers = players.map((p) => p.meta.id);
    expect(PlayerReadinessLogic.shouldAutoStart(game)).toBe(true);
    game.settings = { ...game.settings, autoStart: false };
    expect(PlayerReadinessLogic.shouldAutoStart(game)).toBe(false);
    game.settings = { ...game.settings, autoStart: true };
    game.gameState.readyPlayers = players.map((p) => p.meta.id + 1000);
    expect(PlayerReadinessLogic.shouldAutoStart(game)).toBe(false);
    game.gameState.readyPlayers = players.map((p) => p.meta.id);
    players.forEach((p) => {
      p.gameStatus = PlayerGameStatus.DISCONNECTED;
    });
    expect(PlayerReadinessLogic.shouldAutoStart(game)).toBe(false);
  });

  it("clears readiness when a ready player changes role", () => {
    const game = buildGame("ROLE", null);
    const player = game.players.find((p) => p.role === PlayerRole.PLAYER)!;
    game.gameState.readyPlayers = [player.meta.id];
    PlayerRoleChangeLogic.processRoleChange(game, player, PlayerRole.SPECTATOR);
    expect(game.gameState.readyPlayers).toEqual([]);
  });

  it("persists normalized settings and rejects stored games without them", () => {
    const game = buildGame("SETT", null);
    game.settings = GameSettingsLogic.normalize({ timers: { answerMs: 10_000 } });

    const stored = GameMapper.serializeGameToHash(game);
    const validated = GameRedisValidator.validateRedisData({ ...stored });
    expect(GameMapper.deserializeGameHash(validated).settings).toEqual(game.settings);

    const missingSettings: Record<string, string> = { ...stored };
    delete missingSettings.settings;
    expect(() => GameRedisValidator.validateRedisData(missingSettings)).toThrow(
      '"settings" is required'
    );
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
