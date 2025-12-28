import { Game } from "domain/entities/game/Game";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export interface GamePauseResult {
  game: Game;
  timer: GameStateTimerDTO | null;
}

export interface GamePauseBuildResultInput {
  game: Game;
  timer: GameStateTimerDTO | null;
}

/**
 * Logic class for handling game pause/unpause timer operations.
 * Manages elapsed time calculations and timer state.
 */
export class GamePauseLogic {
  /**
   * Calculate elapsed time for a timer from its start time.
   */
  public static calculateElapsedTime(timer: GameStateTimerDTO): number {
    return Date.now() - new Date(timer.startedAt).getTime();
  }

  /**
   * Update timer with elapsed time for pause operation.
   */
  public static updateTimerForPause(timer: GameStateTimerDTO): void {
    timer.elapsedMs = this.calculateElapsedTime(timer);
  }

  /**
   * Calculate remaining time for timer after unpause.
   */
  public static calculateRemainingTime(timer: GameStateTimerDTO): number {
    const remainingMs = timer.durationMs - (timer.elapsedMs || 0);
    return Math.max(remainingMs, 1); // Minimum 1ms to avoid Redis errors
  }

  /**
   * Update timer with resumedAt timestamp for resume operation.
   * This is called when timer resumes after pause or restore from saved state.
   */
  public static updateTimerForResume(timer: GameStateTimerDTO): void {
    timer.resumedAt = new Date();
  }

  /**
   * Build result for pause/unpause operations.
   */
  public static buildResult(input: GamePauseBuildResultInput): GamePauseResult {
    const { game, timer } = input;

    return {
      game,
      timer,
    };
  }
}
