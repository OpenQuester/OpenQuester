export const TIMER_NSP = "timer";

/**
 * Minimum TTL for timer Redis keys.
 * Ensures timer has enough time to be processed even with slight timing variations.
 */
export const MIN_TIMER_TTL_MS = 1000;
