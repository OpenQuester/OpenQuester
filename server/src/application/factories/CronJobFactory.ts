import { S3FilesCleanupJob } from "application/jobs/S3FilesCleanupJob";
import { FileService } from "application/services/file/FileService";
import { CRON_EXP_2_AM_DAILY } from "domain/constants/cron";
import { ICronJob } from "domain/types/cron/ICronJob";
import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

/**
 * Factory for creating cron job instances
 */
export class CronJobFactory {
  constructor(
    private readonly logger: ILogger,
    private readonly s3Service: S3StorageService,
    private readonly fileService: FileService,
    private readonly env: Environment
  ) {
    //
  }

  /**
   * Create an instance of the S3 files cleanup job
   */
  public createS3FilesCleanupJob(): S3FilesCleanupJob {
    const cronExpression = this.env.getEnvVar(
      "CRON_S3_CLEANUP_EXPRESSION",
      "string",
      CRON_EXP_2_AM_DAILY,
      true
    );

    return new S3FilesCleanupJob(
      this.logger,
      this.s3Service,
      this.fileService,
      cronExpression
    );
  }

  /**
   * Create all available cron jobs
   * This method should be updated when adding new cron jobs
   */
  public createAllCronJobs(): ICronJob[] {
    return [
      this.createS3FilesCleanupJob(),
      // Add more cron jobs here as they are implemented
    ];
  }
}
