export const TIMER_NSP = "timer";

export const MIN_TIMER_TTL_MS = 1;

/**
 * Minimum bid amount used when auto-bidding for a leaving player.
 * Set to 1 to allow reconnection with minimal penalty while still participating.
 */
export const AUTO_BID_MINIMUM = 1;

/**
 * Default question price fallback when actual price is unavailable.
 * Used in stake question winner determination when question data is missing.
 */
export const DEFAULT_QUESTION_PRICE = 1;
