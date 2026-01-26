import { BaseCronJob } from "application/jobs/BaseCronJob";
import { CRON_EXP_3_AM_DAILY } from "domain/constants/cron";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogArchivalService } from "infrastructure/services/log/LogArchivalService";

/**
 * Weekly log archival job.
 *
 * Runs daily, but archives only when the last archive is >= 7 days ago.
 * Executes once on startup to catch missed cron windows.
 */
export class LogArchivalJob extends BaseCronJob {
  public readonly name = "log-archival-job";
  public readonly cronExpression: string;
  public readonly enabled: boolean;
  public readonly runOnStartup = true;

  constructor(
    logger: ILogger,
    private readonly logArchivalService: LogArchivalService,
    cronExpression: string = CRON_EXP_3_AM_DAILY,
    enabled: boolean = true
  ) {
    super(logger);
    this.cronExpression = cronExpression;
    this.enabled = enabled;
  }

  protected async run(): Promise<void> {
    this.logger.info("Running log archival check", {
      prefix: LogPrefix.LOG_ARCHIVAL,
    });

    await this.logArchivalService.checkAndArchive();
  }
}
