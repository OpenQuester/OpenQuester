/** Timers and the nullable integer column use signed 32-bit milliseconds. */
export const MAX_ANSWER_DURATION_MS = 2147483647;

export function answerWindowDuration(
  question: { answerDurationMs?: number | null } | null | undefined,
  roomDefaultMs: number
): number {
  const duration = question?.answerDurationMs;
  return Number.isInteger(duration) && duration! > 0 && duration! <= MAX_ANSWER_DURATION_MS
    ? duration!
    : roomDefaultMs;
}
