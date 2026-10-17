import { describe, expect, it } from "@jest/globals";

import {
  BUZZER_ACCEPT_WINDOW,
  BUZZER_FALSE_START_LOCK_TIME,
  CONTENT_TEXT_MIN_TIME,
  GAME_QUESTION_ANSWER_TIME
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { BuzzerLogic } from "domain/logic/question/BuzzerLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { ButtonPressMode } from "domain/enums/game/GameSettings";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const NOW = Date.parse("2026-01-01T10:00:10.000Z");

/** A SHOWING game whose timer started `elapsedMs` before NOW; players 2 and 3 */
function showingGame(elapsedMs: number, opensAtMs: number): Game {
  const game = buildGame("BUZZ", {
    durationMs: 30_000,
    elapsedMs: 0,
    startedAt: new Date(NOW - elapsedMs),
    resumedAt: null
  });
  game.gameState.skippedPlayers = null;
  game.gameState.buzzerOpensAtMs = opensAtMs;
  return game;
}

describe("BuzzerLogic", () => {
  it("treats a press before the buzzer opens as a false start", () => {
    const game = showingGame(1_000, 2_500);

    expect(BuzzerLogic.isOpen(game, NOW)).toBe(false);
    expect(BuzzerLogic.isOpen(game, NOW + 1_500)).toBe(true);
  });

  it("locks a false-starting player for the lock time, then lets them press", () => {
    const game = showingGame(0, 2_000);

    const until = BuzzerLogic.lockFalseStart(game, 2, NOW);

    expect(until).toBe(NOW + BUZZER_FALSE_START_LOCK_TIME);
    expect(BuzzerLogic.lockedUntil(game, 2, NOW + 100)).toBe(until);
    expect(BuzzerLogic.lockedUntil(game, 3, NOW + 100)).toBeNull();
    expect(BuzzerLogic.lockedUntil(game, 2, until)).toBeNull();
  });

  it("only uses race rules when nobody is designated to answer", () => {
    const game = showingGame(0, 0);
    expect(BuzzerLogic.isRace(game)).toBe(true);

    game.gameState.answeringPlayer = 2;
    expect(BuzzerLogic.isRace(game)).toBe(false);
  });

  it("collects presses in one window and draws among them", () => {
    const game = showingGame(5_000, 0);

    expect(BuzzerLogic.recordPress(game, 3, NOW)).toBe(true);
    expect(BuzzerLogic.recordPress(game, 2, NOW + 120)).toBe(false);
    expect(BuzzerLogic.recordPress(game, 3, NOW + 150)).toBe(false);
    expect(game.gameState.buzzerWindow).toEqual({ openedAt: NOW, presses: [3, 2] });

    // The draw picks by index among the candidates
    expect(BuzzerLogic.drawWinner(game, () => 1)).toBe(2);
    expect(game.gameState.buzzerWindow).toBeNull();
  });

  it("leaves out players who left before the draw", () => {
    const game = showingGame(5_000, 0);
    BuzzerLogic.recordPress(game, 2, NOW);
    BuzzerLogic.recordPress(game, 3, NOW + 50);
    game.getPlayer(2, { fetchDisconnected: true })!.gameStatus = PlayerGameStatus.DISCONNECTED;

    expect(BuzzerLogic.drawWinner(game, () => 0)).toBe(3);
  });

  it("draws nobody when everyone who pressed has left", () => {
    const game = showingGame(5_000, 0);
    BuzzerLogic.recordPress(game, 2, NOW);
    game.getPlayer(2, { fetchDisconnected: true })!.gameStatus = PlayerGameStatus.DISCONNECTED;

    expect(BuzzerLogic.drawWinner(game)).toBeNull();
  });

  it("uses the accept window only in random-within-window mode", () => {
    const game = showingGame(0, 0);
    expect(BuzzerLogic.acceptWindowMs(game)).toBe(BUZZER_ACCEPT_WINDOW);

    game.settings = { ...game.settings, buttonPressMode: ButtonPressMode.FIRST_WINS };
    expect(BuzzerLogic.acceptWindowMs(game)).toBe(0);
  });

  it("drops a pending window when the game pauses or leaves SHOWING", () => {
    const game = showingGame(5_000, 0);
    BuzzerLogic.recordPress(game, 2, NOW);
    game.pause();
    expect(game.gameState.buzzerWindow).toBeNull();

    game.unpause();
    BuzzerLogic.recordPress(game, 2, NOW);
    game.setQuestionState(QuestionState.ANSWERING);
    expect(game.gameState.buzzerWindow).toBeNull();
  });
});

describe("Buzzer opening time", () => {
  it("waits for a caption's reading time, ignoring the answer delay", () => {
    const game = showingGame(0, 0);
    game.gameState.currentQuestion!.text = "Short";
    game.gameState.currentQuestion!.answerDelay = 1_000;

    QuestionContentPlanLogic.applyToGame(game);

    expect(game.gameState.buzzerOpensAtMs).toBe(CONTENT_TEXT_MIN_TIME);
    expect(QuestionContentPlanLogic.questionTimerDuration(game)).toBe(
      CONTENT_TEXT_MIN_TIME + GAME_QUESTION_ANSWER_TIME
    );
  });

  it("waits for a choice question's options before opening", () => {
    const game = showingGame(0, 0);
    const question = game.gameState.currentQuestion!;
    question.type = PackageQuestionType.CHOICE;
    question.text = "Short";
    question.showDelay = 3_000;

    QuestionContentPlanLogic.applyToGame(game);

    expect(game.gameState.buzzerOpensAtMs).toBe(CONTENT_TEXT_MIN_TIME + 3_000);
  });

  it("opens right away when false starts are off, but still times the content", () => {
    const game = showingGame(0, 0);
    game.settings = { ...game.settings, falseStart: false };
    game.gameState.currentQuestion!.text = "Short";
    game.gameState.currentQuestion!.textOrder = 0;

    QuestionContentPlanLogic.applyToGame(game);

    expect(game.gameState.buzzerOpensAtMs).toBe(0);
    expect(QuestionContentPlanLogic.questionTimerDuration(game)).toBe(
      CONTENT_TEXT_MIN_TIME + GAME_QUESTION_ANSWER_TIME
    );
  });
});

describe("GamePauseLogic.calculateElapsedTime", () => {
  it("counts from the start for a timer that never paused", () => {
    expect(
      GamePauseLogic.calculateElapsedTime(
        { durationMs: 20_000, elapsedMs: 0, startedAt: new Date(NOW - 4_000), resumedAt: null },
        NOW
      )
    ).toBe(4_000);
  });

  it("adds the time since resuming to the time used before", () => {
    expect(
      GamePauseLogic.calculateElapsedTime(
        {
          durationMs: 20_000,
          elapsedMs: 6_000,
          startedAt: new Date(NOW - 60_000),
          resumedAt: new Date(NOW - 1_000)
        },
        NOW
      )
    ).toBe(7_000);
  });
});
