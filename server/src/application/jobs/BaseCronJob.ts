import { ICronJob } from "domain/types/cron/ICronJob";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Abstract base class for cron job implementations
 * Provides common functionality and enforces consistent patterns
 */
export abstract class BaseCronJob implements ICronJob {
  public abstract readonly name: string;
  public abstract readonly cronExpression: string;
  public abstract readonly enabled: boolean;

  constructor(protected readonly logger: ILogger) {
    //
  }

  /**
   * Execute the cron job with error handling and logging
   */
  public async execute(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting cron job: ${this.name}`, {
        prefix: "[CRON]: ",
        job: this.name,
      });

      await this.run();

      const duration = Date.now() - startTime;
      this.logger.info(`Completed cron job: ${this.name}`, {
        prefix: "[CRON]: ",
        job: this.name,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to execute cron job: ${this.name}`, {
        prefix: "[CRON]: ",
        job: this.name,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Implement the actual job logic in this method
   * Errors will be caught and logged by the execute method
   */
  protected abstract run(): Promise<void>;
}
