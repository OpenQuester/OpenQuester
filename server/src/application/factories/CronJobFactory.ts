import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { LogArchivalJob } from "application/jobs/LogArchivalJob";
import { GuestCleanupJob } from "application/jobs/GuestCleanupJob";
import { S3FilesCleanupJob } from "application/jobs/S3FilesCleanupJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { FileService } from "application/services/file/FileService";
import {
  CRON_EXP_2_AM_DAILY,
  CRON_EXP_3_AM_DAILY,
  CRON_EXP_EVERY_5_MINUTES
} from "domain/constants/cron";
import { PackageUploadCheckJob } from "application/jobs/PackageUploadCheckJob";
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { ICronJob } from "domain/types/cron/ICronJob";
import { Environment } from "shared/config/Environment";
import { ILogger } from "shared/logging/ILogger";
import { LogArchivalService } from "application/services/log/LogArchivalService";
import { S3StorageService } from "application/services/storage/S3StorageService";

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
    private readonly logArchivalService: LogArchivalService,
    private readonly storageCleanupService: StorageCleanupService,
    private readonly storageRepository: StorageRepository,
    private readonly packageRepository: PackageRepository,
    private readonly packageUploadService: PackageUploadService
  ) {
    this.env = Environment.getInstance(this.logger);
  }

  /**
   * Create an instance of the S3 files cleanup job
   */
  public createS3FilesCleanupJob(): S3FilesCleanupJob {
    const cronExpression = this.env.CRON_S3_CLEANUP_EXPRESSION || CRON_EXP_2_AM_DAILY;

    return new S3FilesCleanupJob(
      this.logger,
      this.s3Service,
      this.fileService,
      this.storageCleanupService,
      this.storageRepository,
      cronExpression
    );
  }

  /** Removes guests nobody has used for GUEST_INACTIVE_DAYS, with their avatars. */
  public createGuestCleanupJob(): GuestCleanupJob {
    return new GuestCleanupJob(
      this.logger,
      this.storageRepository,
      this.storageCleanupService,
      this.env.GUEST_INACTIVE_DAYS,
      this.env.CRON_GUEST_CLEANUP_EXPRESSION
    );
  }

  /** Marks recently uploaded packages ready once storage holds all their media. */
  public createPackageUploadCheckJob(): PackageUploadCheckJob {
    return new PackageUploadCheckJob(
      this.logger,
      this.packageRepository,
      this.packageUploadService,
      CRON_EXP_EVERY_5_MINUTES
    );
  }

  /**
   * Create an instance of the log archival job
   */
  public createLogArchivalJob(): LogArchivalJob {
    const cronExpression = this.env.LOG_ARCHIVE_CRON_EXPRESSION || CRON_EXP_3_AM_DAILY;
    const enabled = this.env.LOG_ARCHIVE_ENABLED;

    return new LogArchivalJob(this.logger, this.logArchivalService, cronExpression, enabled);
  }

  /**
   * Create all available cron jobs
   * This method should be updated when adding new cron jobs
   */
  public createAllCronJobs(): ICronJob[] {
    return [
      this.createS3FilesCleanupJob(),
      this.createLogArchivalJob(),
      this.createGuestCleanupJob(),
      this.createPackageUploadCheckJob()
    ];
  }
}
