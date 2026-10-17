import { serverNow } from "./clock";

export interface TimerLike {
  startedAt: string;
  durationMs: number;
  elapsedMs: number;
  resumedAt?: string | null;
}

/**
 * Milliseconds left on a server timer.
 *
 * `elapsedMs` is time already used before the latest (re)start; the clock has
 * been running again since `resumedAt` (or `startedAt` if never paused).
 */
export function remainingMs(
  timer: TimerLike | null | undefined,
  paused = false,
  now = serverNow(),
): number | null {
  if (!timer) return null;
  const since = Date.parse(timer.resumedAt ?? timer.startedAt);
  const running = paused || Number.isNaN(since) ? 0 : Math.max(0, now - since);
  return Math.max(0, timer.durationMs - timer.elapsedMs - running);
}

export function formatSeconds(ms: number | null): string {
  if (ms == null) return "";
  const s = Math.ceil(ms / 1000);
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return String(s);
}
