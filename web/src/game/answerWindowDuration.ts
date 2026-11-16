/** Mirrors the server's authored answer-window fallback, including legacy zero. */
export function answerWindowDuration(
  question: { answerDurationMs?: number | null } | null | undefined,
  roomDefaultMs: number,
): number {
  const duration = question?.answerDurationMs;
  return Number.isInteger(duration) && duration! > 0 && duration! <= 2147483647
    ? duration!
    : roomDefaultMs;
}
