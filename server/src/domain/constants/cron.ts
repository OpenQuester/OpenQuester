/**  Every day at 2:00 AM UTC */
export const CRON_EXP_2_AM_DAILY = "0 0 2 * * *";

/** Every day at 3:00 AM UTC */
export const CRON_EXP_3_AM_DAILY = "0 0 3 * * *";

/** Every day at 4:00 AM UTC */
export const CRON_EXP_4_AM_DAILY = "0 0 4 * * *";

/** Guests unseen for this many days are cleaned up, unless GUEST_INACTIVE_DAYS says otherwise */
export const DEFAULT_GUEST_INACTIVE_DAYS = 30;

/** Every minute (for testing) */
export const CRON_EXP_EVERY_MINUTE = "0 * * * * *";

/** Every 30 seconds (for testing) */
export const CRON_EXP_EVERY_30_SECONDS = "*/30 * * * * *";

/** Every 5 minutes */
export const CRON_EXP_EVERY_5_MINUTES = "0 */5 * * * *";
