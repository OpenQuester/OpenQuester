/**
 * Interface for cron job implementations
 */
export interface ICronJob {
  /**
   * The name of the cron job for identification and logging
   */
  readonly name: string;

  /**
   * Cron expression defining when the job should run
   * Format: second minute hour day-of-month month day-of-week
   * Example: "0 0 2 * * *" (daily at 2:00 AM UTC)
   */
  readonly cronExpression: string;

  /**
   * Whether the job is enabled and should be scheduled
   */
  readonly enabled: boolean;

  /**
   * TTL in seconds for the distributed lock preventing concurrent execution.
   * Defaults to 3 hours (10800 seconds) if not specified.
   * Should be long enough to handle clock drift between server instances.
   */
  readonly lockTtlSeconds?: number;

  /**
   * Execute the cron job logic
   * This method should handle all errors internally and not throw
   */
  execute(): Promise<void>;
}
