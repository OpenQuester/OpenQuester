import { MIN_TIMER_TTL_MS } from "domain/constants/timer";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export class TimerPersistenceLogic {
  public static getSafeTtlMs(timer: GameStateTimerDTO): number {
    const elapsedMs = timer.elapsedMs ?? 0;
    const remainingMs = timer.durationMs - elapsedMs;

    return Math.max(remainingMs, MIN_TIMER_TTL_MS);
  }
}
