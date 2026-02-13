import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { LogArchivalJob } from "application/jobs/LogArchivalJob";
import { S3FilesCleanupJob } from "application/jobs/S3FilesCleanupJob";
import { FileService } from "application/services/file/FileService";
import {
  CRON_EXP_2_AM_DAILY,
  CRON_EXP_3_AM_DAILY,
} from "domain/constants/cron";
import { ICronJob } from "domain/types/cron/ICronJob";
import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogArchivalService } from "infrastructure/services/log/LogArchivalService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

/**
 * Factory for creating cron job instances.
 */
@singleton()
export class CronJobFactory {
  private readonly env: Environment;

  constructor(
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    private readonly s3Service: S3StorageService,
    private readonly fileService: FileService,
    private readonly logArchivalService: LogArchivalService
  ) {
    this.env = Environment.getInstance(this.logger);
  }

  /**
   * Create an instance of the S3 files cleanup job
   */
  public createS3FilesCleanupJob(): S3FilesCleanupJob {
    const cronExpression =
      this.env.CRON_S3_CLEANUP_EXPRESSION || CRON_EXP_2_AM_DAILY;

    return new S3FilesCleanupJob(
      this.logger,
      this.s3Service,
      this.fileService,
      cronExpression
    );
  }

  /**
   * Create an instance of the log archival job
   */
  public createLogArchivalJob(): LogArchivalJob {
    const cronExpression =
      this.env.LOG_ARCHIVE_CRON_EXPRESSION || CRON_EXP_3_AM_DAILY;
    const enabled = this.env.LOG_ARCHIVE_ENABLED;

    return new LogArchivalJob(
      this.logger,
      this.logArchivalService,
      cronExpression,
      enabled
    );
  }

  /**
   * Create all available cron jobs
   * This method should be updated when adding new cron jobs
   */
  public createAllCronJobs(): ICronJob[] {
    return [this.createS3FilesCleanupJob(), this.createLogArchivalJob()];
  }
}
