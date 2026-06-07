import { createHash } from "node:crypto";
import https from "node:https";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { FileService } from "application/services/file/FileService";
import { FileUsageService } from "application/services/file/FileUsageService";
import { UserService } from "application/services/user/UserService";
import { UPLOAD_FILE_LINK_EXPIRES_IN } from "domain/constants/storage";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import type { S3Context } from "domain/types/file/S3Context";
import { type File } from "infrastructure/database/models/File";
import { type Package } from "infrastructure/database/models/package/Package";
import { Permission } from "infrastructure/database/models/Permission";
import { type User } from "infrastructure/database/models/User";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";
import { DependencyService } from "application/services/dependency/DependencyService";
import { type ObjectStorage } from "shared/storage/ObjectStorage";
import { StorageUtils } from "infrastructure/utils/StorageUtils";
import { ValueUtils } from "domain/utils/ValueUtils";

export interface UsageEntries {
  users: User[];
  packages: Package[];
}

/**
 * Service for S3-compatible object storage operations.
 */
@singleton()
export class S3StorageService {
  constructor(
    @inject(DI_TOKENS.S3Context) private readonly s3Context: S3Context,
    @inject(DI_TOKENS.ObjectStorage) private readonly objectStorage: ObjectStorage,
    private readonly fileService: FileService,
    private readonly fileUsageService: FileUsageService,
    private readonly userService: UserService,
    private readonly dependencyService: DependencyService,
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Get the ignored cleanup folder from S3 context
   * Returns empty string if not configured
   */
  public getIgnoredCleanupFolder(): string {
    return this.objectStorage.getIgnoredCleanupFolder();
  }

  public async generatePresignedUrl(
    type: "PUT" | "GET",
    bucket: string,
    filenameWithPath: string,
    expiresInSeconds: number,
    filename: string
  ) {
    return this.objectStorage.generatePresignedUrl({
      operation: type,
      bucket,
      key: filenameWithPath,
      expiresInSeconds,
      contentMd5Hex: type === "PUT" ? filename : undefined
    });
  }

  public getUrl(filename: string) {
    return this.fileUrlBuilder.getUrl(filename);
  }

  /**
   * Fetches user avatar from discord's cdn and saves on out s3 bucket
   * @param cdnLink discord's cdn link for avatar file
   * @param filename filename which will be assigned to file in bucket and DB
   * @returns
   */
  /**
   * Upload file from Discord CDN to S3
   */
  public async putFileFromDiscord(cdnLink: string, filename: string): Promise<string | false> {
    const log = this.logger.performance(`Discord file upload`, {
      prefix: LogPrefix.S3,
      filename
    });

    return new Promise<string | false>((resolve) => {
      https
        .get(cdnLink, (res) => {
          if (res.statusCode !== 200) {
            this.logger.error(`Discord CDN fetch failed`, {
              prefix: LogPrefix.S3,
              statusCode: res.statusCode,
              filename
            });
            log.finish();
            resolve(false);
            return;
          }

          const chunks: Buffer[] = [];

          res.on("data", (chunk) => {
            chunks.push(chunk);
          });

          res.on("end", async () => {
            const fileBuffer = Buffer.concat(chunks);

            const md5Hash = createHash("md5").update(fileBuffer).digest("hex");

            try {
              await this.objectStorage.putObject({
                bucket: this.s3Context.bucket,
                key: StorageUtils.parseFilePath(md5Hash),
                body: fileBuffer,
                contentLength: fileBuffer.length
              });

              resolve(md5Hash);
            } catch (err) {
              this.logger.error(`S3 upload failed`, {
                prefix: LogPrefix.S3,
                filename,
                error: err instanceof Error ? err.message : String(err)
              });
              resolve(false);
            } finally {
              log.finish();
            }
          });
        })
        .on("error", (err) => {
          this.logger.error(`Discord CDN request failed`, {
            prefix: LogPrefix.S3,
            error: err.message
          });
          resolve(false);
        });
    });
  }

  public async upload(filename: string, expiresIn: number = UPLOAD_FILE_LINK_EXPIRES_IN) {
    return this.performFileUpload(filename, expiresIn);
  }

  public async generatePresignedUrls(
    files: FileDTO[],
    expiresIn: number = UPLOAD_FILE_LINK_EXPIRES_IN
  ) {
    const links: Record<string, string> = {};
    for (const file of files) {
      const filename = ValueUtils.getRawFilename(file.filename.toLowerCase());

      links[filename] = await this.generatePresignedUrl(
        "PUT",
        this.s3Context.bucket,
        `${file.path}${filename}`,
        expiresIn,
        filename
      );
    }

    return links;
  }

  public async performFileUpload(
    filename: string,
    expiresIn: number,
    source?: FileSource,
    user?: User,
    pack?: Package
  ) {
    if (!source) {
      source = FileSource.S3;
    }

    const filenameWithPath = StorageUtils.parseFilePath(filename);

    const link = await this.generatePresignedUrl(
      "PUT",
      this.s3Context.bucket,
      filenameWithPath,
      expiresIn,
      filename
    );

    const file = await this._writeFile(filenameWithPath.replace(filename, ""), filename, source);

    if (user || pack) {
      await this._writeUsage(file, user, pack);
    }
    return link;
  }

  /**
   * Delete file with usage validation
   */
  public async delete(filename: string, sessionUserId: number | undefined) {
    const usageRecords = await this.dependencyService.getFileUsage(filename);

    if (usageRecords.length < 1) {
      this.logger.debug(`File deletion attempted but no usage records found`, {
        prefix: LogPrefix.S3,
        filename,
        userId: sessionUserId
      });
      return;
    }

    const usage: UsageEntries = {
      users: [],
      packages: []
    };

    usageRecords.forEach((u) => {
      if (u.user) {
        usage.users.push(u.user);
      }
      if (u.package?.author) {
        usage.packages.push(u.package);
      }
    });

    const usedInPackages = usage.packages.length > 0;
    const usedByUsers = usage.users.length > 0;

    const result = { removed: false };

    if (usedInPackages && !usedByUsers) {
      const packages = usage.packages.map((p) => p.title).join(", ");
      throw new ClientError(ClientResponse.DELETE_FROM_PACKAGE, 400, {
        packages
      });
    }

    if (usedByUsers) {
      result.removed = await this._handleAvatarRemove(sessionUserId, filename, usage);
    }

    if (!result.removed) {
      throw new ClientError(ClientResponse.NO_PERMISSION, HttpStatus.FORBIDDEN);
    }

    const file = await this.fileService.getFileByFilename(filename);

    if (!file) {
      return;
    }

    const fileUsage = await this.dependencyService.getFileUsage(file.filename);

    if (fileUsage.length > 0) {
      // Do not delete file if it's still used somewhere
      return;
    }

    await this.deleteFileFromStorage(filename);
  }

  /**
   * Delete file from S3 storage and remove from database (used for package deletion)
   */
  public async deleteFileFromStorage(filename: string): Promise<void> {
    const filePath = StorageUtils.parseFilePath(filename);
    await this.fileService.removeFile(filename);
    await this.objectStorage.deleteObject(this.s3Context.bucket, filePath);
  }

  /**
   * List all files in S3 bucket as async generator for memory efficiency
   * Yields batches of files with both S3 keys and extracted filenames
   * This is useful for cleanup operations where we need the original S3 keys
   * @param batchSize - Number of files to yield per batch (maximum: 1000)
   */
  public async *listS3FilesInBatches(
    batchSize: number = 1000
  ): AsyncGenerator<{ filename: string; s3Key: string }[]> {
    let totalProcessed = 0;

    try {
      for await (const files of this.objectStorage.listObjectsInBatches(
        this.s3Context.bucket,
        batchSize
      )) {
        if (files.length > 0) {
          totalProcessed += files.length;
          yield files.map((file) => ({ filename: file.filename, s3Key: file.key }));

          // Log progress for large buckets
          if (totalProcessed % 10000 === 0) {
            this.logger.info(
              `List S3 files in batches: Processed ${totalProcessed} files so far...`,
              {
                prefix: LogPrefix.S3_CLEANUP,
                totalProcessed
              }
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list S3 objects in batches`, {
        prefix: LogPrefix.S3_CLEANUP,
        totalProcessed,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete files by their S3 keys directly in batches (for cleanup of orphaned files)
   * Only deletes from S3 storage, does not touch database records
   */
  public async deleteFilesByS3Keys(s3Keys: string[]): Promise<void> {
    if (s3Keys.length === 0) {
      return;
    }

    // S3 DeleteObjects can handle up to 1000 objects per request
    const BATCH_SIZE = 1000;

    this.logger.info(`Starting batch deletion of ${s3Keys.length} files from S3`, {
      prefix: LogPrefix.S3_CLEANUP,
      batches: Math.ceil(s3Keys.length / BATCH_SIZE)
    });

    let totalDeleted = 0;
    let totalErrors = 0;

    for (let i = 0; i < s3Keys.length; i += BATCH_SIZE) {
      const batch = s3Keys.slice(i, i + BATCH_SIZE);
      try {
        const result = await this.objectStorage.deleteObjects(this.s3Context.bucket, batch);

        const batchDeleted = batch.length;
        totalDeleted += batchDeleted;

        // Log any errors that occurred during batch deletion
        if (result.errors.length > 0) {
          totalErrors += result.errors.length;
          for (const error of result.errors) {
            this.logger.error(`Failed to delete file from S3 in batch`, {
              prefix: LogPrefix.S3_CLEANUP,
              key: error.key,
              code: error.code,
              message: error.message
            });
          }
        }

        this.logger.info(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            s3Keys.length / BATCH_SIZE
          )} completed`,
          {
            prefix: LogPrefix.S3_CLEANUP,
            deletedInBatch: batchDeleted - result.errors.length,
            errorsInBatch: result.errors.length,
            totalProgress: `${totalDeleted}/${s3Keys.length}`
          }
        );
      } catch (error) {
        totalErrors += batch.length;
        this.logger.error(`Batch delete failed entirely`, {
          prefix: LogPrefix.S3_CLEANUP,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.info(
      `Completed S3 deletion: ${totalDeleted - totalErrors} succeeded, ${totalErrors} failed`,
      {
        prefix: LogPrefix.S3_CLEANUP,
        totalFiles: s3Keys.length,
        successCount: totalDeleted - totalErrors,
        errorCount: totalErrors
      }
    );
  }

  private async _handleAvatarRemove(
    sessionUserId: number | undefined,
    filename: string,
    usage: UsageEntries
  ) {
    let user: User;

    try {
      user = await this.userService.getUserBySession(sessionUserId, {
        select: ["id"],
        relations: ["permissions"],
        relationSelects: { permissions: ["id", "name"] }
      });
    } catch {
      return false;
    }

    const hasPermission = await Permission.checkPermission(user, Permissions.DELETE_FILE);

    for (const u of usage.users) {
      if (u.id !== user.id && !hasPermission) {
        continue;
      }

      if (u.avatar?.filename === filename) {
        await this._deleteUserAvatar(u);
        await this._deleteAvatarUsage(filename, u);
        return true;
      }
    }

    return false;
  }

  private async _deleteUserAvatar(user: User) {
    if (user.avatar) {
      await this.userService.update(user, {
        avatar: undefined
      });
    }
  }

  private async _deleteAvatarUsage(filename: string, user: User) {
    const file = await this.fileService.getFileByFilename(filename);
    if (file) {
      await this.fileUsageService.deleteUsage(file, user);
    }
  }

  private async _writeUsage(file: File, user?: User, pack?: Package) {
    return this.fileUsageService.writeUsage(file, user, pack);
  }

  private async _writeFile(path: string, filename: string, source: FileSource) {
    return this.fileService.writeFile(path, filename, source);
  }

  /**
   * Uploads random test files to S3 that are not tracked in the database.
   * Used for testing S3 cleanup jobs.
   *
   * @param count Number of random files to upload (default: 5)
   * @returns Array of uploaded filenames
   */
  public async uploadRandomTestFiles(count: number = 5): Promise<string[]> {
    this.logger.audit(`Uploading test files to S3`, {
      prefix: LogPrefix.S3,
      count
    });

    const uploadedFiles: string[] = [];

    for (let i = 0; i < count; i++) {
      const randomContent = this._generateRandomContent();
      const md5Hash = createHash("md5").update(randomContent).digest("hex");
      const filePath = StorageUtils.parseFilePath(md5Hash);

      try {
        await this.objectStorage.putObject({
          bucket: this.s3Context.bucket,
          key: filePath,
          body: randomContent,
          contentLength: Buffer.byteLength(randomContent)
        });
        uploadedFiles.push(md5Hash);
      } catch (err) {
        this.logger.error(`Test file upload failed`, {
          prefix: LogPrefix.S3,
          fileNumber: i + 1,
          totalCount: count,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    this.logger.audit(`Test files uploaded to S3`, {
      prefix: LogPrefix.S3,
      uploadedCount: uploadedFiles.length,
      files: uploadedFiles
    });

    return uploadedFiles;
  }

  /**
   * Generates random content for test files
   */
  private _generateRandomContent(): Buffer {
    const size = Math.floor(Math.random() * 10000) + 1000; // 1KB to 10KB
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let content = "";

    for (let i = 0; i < size; i++) {
      content += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return Buffer.from(content, "utf8");
  }
}
