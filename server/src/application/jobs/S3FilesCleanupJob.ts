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
   * Execute the S3 cleanup process
   * 1. List all files in S3 bucket
   * 2. Get all filenames from database
   * 3. Find orphaned files (in S3 but not in DB)
   * 4. Delete orphaned files from S3 in batches
   */
  protected async run(): Promise<void> {
    const log = this.logger.performance("S3 Files Cleanup Job");
    this.logger.info("Starting S3 files cleanup process", {
      prefix: "[S3_CLEANUP]: ",
    });

    try {
      // Step 1: Get all files from S3 with their S3 keys
      this.logger.info("Listing all files in S3 bucket...", {
        prefix: "[S3_CLEANUP]: ",
      });

      const s3Log = this.logger.performance("List all files in S3");

      const s3FilesWithKeys = await this.s3Service.listAllS3FilesWithKeys();

      s3Log.finish();

      // Step 2: Get all filenames from database
      this.logger.info("Fetching all filenames from database...", {
        prefix: "[S3_CLEANUP]: ",
      });

      const fileLog = this.logger.performance(
        "Fetch all filenames from database"
      );

      const dbFilenames = await this.fileService.getAllFilenames();

      fileLog.finish();

      const dbFilenamesSet = new Set(dbFilenames);

      // Filter out files from ignored folder
      const ignoredFolder = this.s3Service.getIgnoredCleanupFolder();
      const filteredS3Files = ignoredFolder
        ? s3FilesWithKeys.filter((file) => !this.shouldIgnoreFile(file.s3Key))
        : s3FilesWithKeys;

      const ignoredCount = s3FilesWithKeys.length - filteredS3Files.length;

      this.logger.info("Comparison stats", {
        prefix: "[S3_CLEANUP]: ",
        s3Files: s3FilesWithKeys.length,
        s3FilesAfterFilter: filteredS3Files.length,
        dbFiles: dbFilenames.length,
        ignoredFolder: ignoredFolder || "none",
        ignoredFilesCount: ignoredCount,
      });

      // Step 3: Find orphaned files (exist in S3 but not in database)
      const orphanedFiles = filteredS3Files.filter(
        (file) => !dbFilenamesSet.has(file.filename)
      );

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

      // Step 4: Delete ALL orphaned files from S3 using their S3 keys
      // This handles both valid MD5 files and invalid naming convention files
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
