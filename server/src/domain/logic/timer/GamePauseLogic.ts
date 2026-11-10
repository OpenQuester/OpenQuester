import { MIN_TIMER_TTL_MS } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { GamePauseBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";

export interface GamePauseData {
  game: Game;
  timer: GameStateTimerDTO | null;
}

export interface GamePauseResult {
  data: GamePauseData;
  broadcasts: SocketEventBroadcast[];
}

export interface GamePauseBuildResultInput {
  game: Game;
  timer: GameStateTimerDTO | null;
  isPause: boolean;
}

/**
 * Logic class for handling game pause/unpause timer operations.
 * Manages elapsed time calculations and timer state.
 */
export class GamePauseLogic {
  public static startDelayMs(timer: GameStateTimerDTO, now = Date.now()): number {
    const since = new Date(timer.resumedAt ?? timer.startedAt).getTime();
    return Number.isFinite(since) ? Math.max(0, since - now) : 0;
  }

  /**
   * Time the timer has run: what it used before its latest (re)start plus the
   * time since then. A timer resumed after a pause or an answer keeps counting
   * from its saved elapsed time instead of from its original start.
   */
  public static calculateElapsedTime(timer: GameStateTimerDTO, now: number = Date.now()): number {
    const since = new Date(timer.resumedAt ?? timer.startedAt).getTime();
    const running = Number.isFinite(since) ? Math.max(0, now - since) : 0;

    return (timer.resumedAt ? timer.elapsedMs || 0 : 0) + running;
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
  public static calculateRemainingTime(timer: GameStateTimerDTO, now = Date.now()): number {
    const remainingMs = timer.durationMs - (timer.elapsedMs || 0);

    return Math.max(remainingMs + this.startDelayMs(timer, now), MIN_TIMER_TTL_MS);
  }

  /**
   * Update timer with resumedAt timestamp for resume operation.
   * This is called when timer resumes after pause or restore from saved state.
   */
  public static updateTimerForResume(
    timer: GameStateTimerDTO,
    pausedAt?: number | null,
    now = Date.now()
  ): void {
    const delay = pausedAt == null ? 0 : this.startDelayMs(timer, pausedAt);
    timer.resumedAt = new Date(now + delay);
  }

  /**
   * Build result for pause/unpause operations with broadcasts.
   */
  public static buildResult(input: GamePauseBuildResultInput): GamePauseResult {
    const { game, timer, isPause } = input;

    const broadcastData = {
      timer,
      questionTransition: game.gameState.questionTransition ?? null
    } satisfies GamePauseBroadcastData;
    const event = isPause ? SocketIOGameEvents.GAME_PAUSE : SocketIOGameEvents.GAME_UNPAUSE;

    const broadcasts: SocketEventBroadcast[] = [
      {
        event,
        data: broadcastData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<GamePauseBroadcastData>
    ];

    return {
      data: { game, timer },
      broadcasts
    };
  }
}
