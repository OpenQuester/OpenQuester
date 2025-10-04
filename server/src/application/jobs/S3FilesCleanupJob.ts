import { BaseCronJob } from "application/jobs/BaseCronJob";
import { FileService } from "application/services/file/FileService";
import { CRON_EXP_2_AM_DAILY } from "domain/constants/cron";
import { ILogger } from "infrastructure/logger/ILogger";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

/**
 * Daily cleanup job for orphaned S3 files
 * Removes files that exist in S3 but not in the database
 */
export class S3FilesCleanupJob extends BaseCronJob {
  public readonly name = "S3FilesCleanupJob";
  public readonly cronExpression: string;
  public readonly enabled = true;

  constructor(
    logger: ILogger,
    private readonly s3Service: S3StorageService,
    private readonly fileService: FileService,
    cronExpression: string = CRON_EXP_2_AM_DAILY
  ) {
    super(logger);
    this.cronExpression = cronExpression;
  }

  /**
   * Check if a file should be ignored based on its S3 key
   */
  private shouldIgnoreFile(s3Key: string): boolean {
    const ignoredFolder = this.s3Service.getIgnoredCleanupFolder();
    if (!ignoredFolder) {
      return false;
    }
    return s3Key.startsWith(ignoredFolder);
  }

  /**
   * Execute the S3 cleanup process in batches for memory efficiency
   * 1. Fetch S3 files in batches (1000 files at a time)
   * 2. For each batch, check which filenames exist in DB
   * 3. Collect orphaned files (in S3 but not in DB)
   * 4. After processing all batches, delete all orphaned files
   */
  protected async run(): Promise<void> {
    const log = this.logger.performance("S3 Files Cleanup Job");
    this.logger.info("Starting S3 files cleanup process", {
      prefix: "[S3_CLEANUP]: ",
    });

    const BATCH_SIZE = 1000;
    const orphanedFiles: { filename: string; s3Key: string }[] = [];
    const ignoredFolder = this.s3Service.getIgnoredCleanupFolder();

    let totalS3Files = 0;
    let totalIgnored = 0;
    let batchNumber = 0;

    try {
      // Process S3 files in batches
      for await (const s3Batch of this.s3Service.listS3FilesInBatches(
        BATCH_SIZE
      )) {
        batchNumber++;
        totalS3Files += s3Batch.length;

        // Filter out files from ignored folder
        const filteredBatch = ignoredFolder
          ? s3Batch.filter((file) => !this.shouldIgnoreFile(file.s3Key))
          : s3Batch;

        totalIgnored += s3Batch.length - filteredBatch.length;

        if (filteredBatch.length === 0) {
          continue;
        }

        // Extract filenames for DB check
        const filenames = filteredBatch.map((file) => file.filename);

        // Check which filenames exist in database
        const existingFilenames = await this.fileService.getExistingFilenames(
          filenames
        );
        const existingSet = new Set(existingFilenames);

        // Find orphaned files in this batch
        const batchOrphaned = filteredBatch.filter(
          (file) => !existingSet.has(file.filename)
        );

        orphanedFiles.push(...batchOrphaned);

        this.logger.debug(`Batch ${batchNumber} processed`);
      }

      // Log final statistics
      this.logger.info("S3 file processing complete", {
        prefix: "[S3_CLEANUP]: ",
        totalS3Files,
        totalIgnored,
        totalProcessed: totalS3Files - totalIgnored,
        totalOrphaned: orphanedFiles.length,
        ignoredFolder: ignoredFolder || "none",
        batchesProcessed: batchNumber,
      });

      // Delete orphaned files if any found
      if (orphanedFiles.length === 0) {
        this.logger.info("No orphaned files found in S3", {
          prefix: "[S3_CLEANUP]: ",
        });
        return;
      }

      this.logger.info(`Found ${orphanedFiles.length} orphaned files in S3`, {
        prefix: "[S3_CLEANUP]: ",
        orphanedCount: orphanedFiles.length,
      });

      // Delete ALL orphaned files from S3 using their S3 keys
      const s3KeysToDelete = orphanedFiles.map((file) => file.s3Key);

      await this.s3Service.deleteFilesByS3Keys(s3KeysToDelete);

      this.logger.info(
        `Successfully cleaned up ${orphanedFiles.length} orphaned files from S3`,
        {
          prefix: "[S3_CLEANUP]: ",
          deletedCount: orphanedFiles.length,
        }
      );
    } catch (error) {
      this.logger.error("S3 cleanup process failed", {
        prefix: "[S3_CLEANUP]: ",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw to trigger the error handling in BaseCronJob
    } finally {
      log.finish();
    }
  }
}
