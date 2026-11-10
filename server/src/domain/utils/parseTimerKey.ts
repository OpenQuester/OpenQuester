import { questionTransitionTimerKey } from "domain/constants/redisKeys";
import { TIMER_NSP } from "domain/constants/timer";

export enum TimerKeyType {
  ACTIVE = "active",
  QUESTION_TRANSITION = "question-transition",
  SAVED = "saved"
}

export type ParsedTimerKey =
  | { type: TimerKeyType.ACTIVE | TimerKeyType.QUESTION_TRANSITION; gameId: string }
  | { type: TimerKeyType.SAVED; gameId: string; timerAdditional: string };

/** Distinguish running timers from saved pause state; reject malformed keys. */
export function parseTimerKey(key: string): ParsedTimerKey | null {
  const parts = key.split(":");
  if (parts[0] !== TIMER_NSP) {
    return null;
  }
  if (parts.length === 2 && parts[1]) {
    return { type: TimerKeyType.ACTIVE, gameId: parts[1] };
  }
  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    return null;
  }

  const [, timerAdditional, gameId] = parts;
  if (key === questionTransitionTimerKey(gameId)) {
    return { type: TimerKeyType.QUESTION_TRANSITION, gameId };
  }
  return { type: TimerKeyType.SAVED, gameId, timerAdditional };
}
