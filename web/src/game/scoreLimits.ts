/** Mirrors server/domain/constants/game.ts: soft cap inside PostgreSQL int32. */
export const SCORE_ABS_LIMIT = 2_100_000_000;

export function clampScore(score: number): number {
  return Math.max(-SCORE_ABS_LIMIT, Math.min(SCORE_ABS_LIMIT, score));
}
