import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type Request } from "express";
import { createHash } from "node:crypto";
import https from "node:https";

import { FileService } from "application/services/file/FileService";
import { FileUsageService } from "application/services/file/FileUsageService";
import { UserService } from "application/services/user/UserService";
import { UPLOAD_FILE_LINK_EXPIRES_IN } from "domain/constants/storage";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ClientError } from "domain/errors/ClientError";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { S3Context } from "domain/types/file/S3Context";
import { UsageEntries } from "domain/types/usage/usage";
import { type File } from "infrastructure/database/models/File";
import { type Package } from "infrastructure/database/models/package/Package";
import { Permission } from "infrastructure/database/models/Permission";
import { type User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { DependencyService } from "infrastructure/services/dependency/DependencyService";
import { StorageUtils } from "infrastructure/utils/StorageUtils";
import { TemplateUtils } from "infrastructure/utils/TemplateUtils";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class S3StorageService {
  private _client: S3Client;

  constructor(
    private readonly s3Context: S3Context,
    private readonly fileService: FileService,
    private readonly fileUsageService: FileUsageService,
    private readonly userService: UserService,
    private readonly dependencyService: DependencyService,
    private readonly logger: ILogger
  ) {
    this._client = new S3Client({
      credentials: {
        accessKeyId: this.s3Context.accessKey,
        secretAccessKey: this.s3Context.secretKey,
      },
      forcePathStyle: true,
      endpoint: this.s3Context.endpoint,
      region: this.s3Context.region,
    });
  }

  /**
   * Get the ignored cleanup folder from S3 context
   * Returns empty string if not configured
   */
  public getIgnoredCleanupFolder(): string {
    return this.s3Context.ignoredCleanupFolder || "";
  }

  public async generatePresignedUrl(
    type: "PUT" | "GET",
    bucket: string,
    filenameWithPath: string,
    expiresInSeconds: number,
    filename: string
  ) {
    let command: PutObjectCommand | GetObjectCommand;
    let opts = {};

    switch (type) {
      case "PUT":
        command = new PutObjectCommand({
          Bucket: bucket,
          Key: filenameWithPath,
          ContentMD5: Buffer.from(filename, "hex").toString("base64"),
          IfNoneMatch: "*",
        });

        // Unhoistable means headers that cannot be ignored
        opts = {
          expiresIn: expiresInSeconds,
          unhoistableHeaders: new Set(["Content-MD5", "If-None-Match"]),
        };
        break;
      case "GET":
        command = new GetObjectCommand({
          Bucket: bucket,
          Key: filenameWithPath,
        });
        opts = {
          expiresIn: expiresInSeconds,
        };
        break;
    }

    return getSignedUrl(this._client, command, opts);
  }

  public getUrl(filename: string) {
    const filePath = StorageUtils.parseFilePath(filename);
    // Support both subdomain and path-style bucket formats
    if (this.s3Context.useSubDomainBucketFormat) {
      const baseUrl = this.s3Context.urlPrefix.endsWith("/")
        ? this.s3Context.urlPrefix.slice(0, -1)
        : this.s3Context.urlPrefix;
      return `${baseUrl}/${filePath}`;
    } else {
      // Path-style: endpoint/bucket/file-path
      const endpoint = this.s3Context.endpoint.endsWith("/")
        ? this.s3Context.endpoint.slice(0, -1)
        : this.s3Context.endpoint;
      return `${endpoint}/${this.s3Context.bucket}/${filePath}`;
    }
  }

  /**
   * Fetches user avatar from discord's cdn and saves on out s3 bucket
   * @param cdnLink discord's cdn link for avatar file
   * @param filename filename which will be assigned to file in bucket and DB
   * @returns
   */
  public async putFileFromDiscord(
    cdnLink: string,
    filename: string
  ): Promise<any> {
    this.logger.trace(`Discord file upload started for ${filename}`, {
      prefix: "[S3StorageService]: ",
      cdnLink,
      filename,
    });

    const log = this.logger.performance(`Discord file upload`, {
      cdnLink,
      filename,
    });

    return new Promise((resolve) => {
      https
        .get(cdnLink, (res) => {
          if (res.statusCode !== 200) {
            this.logger.error(
              `Failed to fetch file from CDN (${cdnLink}): ${res.statusCode}`,
              {
                prefix: "[S3StorageService]: ",
                statusCode: res.statusCode,
              }
            );
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

            const command = new PutObjectCommand({
              Bucket: this.s3Context.bucket,
              Key: StorageUtils.parseFilePath(md5Hash),
              Body: fileBuffer,
              ContentLength: fileBuffer.length,
            });

            try {
              await this._client.send(command);

              resolve(md5Hash);
            } catch (err) {
              this.logger.error(
                TemplateUtils.text(ServerResponse.BUCKET_UPLOAD_FAILED, {
                  filename,
                  err,
                }),
                {
                  prefix: "[S3StorageService]: ",
                  errorMessage: err,
                }
              );
              resolve(false);
            } finally {
              log.finish();
            }
          });
        })
        .on("error", (err) => {
          this.logger.error(
            TemplateUtils.text(ServerResponse.BUCKET_UPLOAD_FAILED, {
              cdnLink,
              err,
            }),
            {
              prefix: "[S3StorageService]: ",
              errorMessage: err,
            }
          );
          resolve(false);
        });
    });
  }

  public async upload(
    filename: string,
    expiresIn: number = UPLOAD_FILE_LINK_EXPIRES_IN
  ) {
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

    const file = await this._writeFile(
      filenameWithPath.replace(filename, ""),
      filename,
      source
    );

    if (user || pack) {
      await this._writeUsage(file, user, pack);
    }
    return link;
  }

  public async delete(filename: string, req: Request) {
    const usageRecords = await this.dependencyService.getFileUsage(filename);

    if (usageRecords.length < 1) {
      this.logger.debug(
        `Trying to delete file ${filename} but no usage records found, user ${
          req.user?.id || "unknown"
        }`
      );
      return;
    }

    const usage: UsageEntries = {
      users: [],
      packages: [],
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
        packages,
      });
    }

    if (usedByUsers) {
      result.removed = await this._handleAvatarRemove(req, filename, usage);
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

    const command = new DeleteObjectCommand({
      Bucket: this.s3Context.bucket,
      Key: filePath,
    });
    await this._client.send(command);
  }

  /**
   * Delete multiple files from S3 storage in batch
   * Note: Database file records should be removed separately before calling this method
   */
  public async deleteFilesFromStorage(filenames: string[]): Promise<void> {
    if (filenames.length === 0) {
      return;
    }

    // S3 DeleteObjects can handle up to 1000 objects per request
    const BATCH_SIZE = 1000;

    for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
      const batch = filenames.slice(i, i + BATCH_SIZE);
      const objects = batch.map((filename) => ({
        Key: StorageUtils.parseFilePath(filename),
      }));

      const command = new DeleteObjectsCommand({
        Bucket: this.s3Context.bucket,
        Delete: {
          Objects: objects,
          Quiet: true, // Don't return info about deleted objects to reduce response size
        },
      });

      try {
        const result = await this._client.send(command);

        // Log any errors that occurred during batch deletion
        if (result.Errors && result.Errors.length > 0) {
          for (const error of result.Errors) {
            this.logger.error(`Failed to delete file from S3 in batch`, {
              key: error.Key,
              code: error.Code,
              message: error.Message,
            });
          }
        }
      } catch (error) {
        this.logger.error(`Batch delete failed for files`, {
          filenames: batch,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
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
    let continuationToken: string | undefined;
    let totalProcessed = 0;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.s3Context.bucket,
        MaxKeys: batchSize,
        ContinuationToken: continuationToken,
      });

      try {
        const response = await this._client.send(command);

        if (response.Contents && response.Contents.length > 0) {
          const files = response.Contents.filter((obj) => obj.Key) // Filter out undefined keys
            .map((obj) => {
              const s3Key = obj.Key!;
              const parts = s3Key.split("/");
              const filename = parts[parts.length - 1]; // Get the filename part
              return { filename, s3Key };
            });

          totalProcessed += files.length;
          yield files;

          // Log progress for large buckets
          if (totalProcessed % 10000 === 0) {
            this.logger.info(
              `List S3 files in batches: Processed ${totalProcessed} files so far...`
            );
          }
        }

        continuationToken = response.NextContinuationToken;
      } catch (error) {
        this.logger.error(`Failed to list S3 objects in batches`, {
          continuationToken,
          totalProcessed,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } while (continuationToken);
  }

  /**
   * Delete files by their S3 keys directly in batches (for cleanup of orphaned files)
   * Uses batch DeleteObjectsCommand with checksum calculation disabled
   * Only deletes from S3 storage, does not touch database records
   */
  public async deleteFilesByS3Keys(s3Keys: string[]): Promise<void> {
    if (s3Keys.length === 0) {
      return;
    }

    // S3 DeleteObjects can handle up to 1000 objects per request
    const BATCH_SIZE = 1000;

    this.logger.info(
      `Starting batch deletion of ${s3Keys.length} files from S3`,
      {
        prefix: "[S3_CLEANUP]: ",
        batches: Math.ceil(s3Keys.length / BATCH_SIZE),
      }
    );

    let totalDeleted = 0;
    let totalErrors = 0;

    for (let i = 0; i < s3Keys.length; i += BATCH_SIZE) {
      const batch = s3Keys.slice(i, i + BATCH_SIZE);
      const objects = batch.map((key) => ({
        Key: key,
      }));

      const command = new DeleteObjectsCommand({
        Bucket: this.s3Context.bucket,
        Delete: {
          Objects: objects,
          Quiet: true,
        },
      });

      // Apply MinIO compatibility workaround
      this._applyMinioContentMD5Workaround(command, objects);

      try {
        const result = await this._client.send(command);

        const batchDeleted = batch.length;
        totalDeleted += batchDeleted;

        // Log any errors that occurred during batch deletion
        if (result.Errors && result.Errors.length > 0) {
          totalErrors += result.Errors.length;
          for (const error of result.Errors) {
            this.logger.error(`Failed to delete file from S3 in batch`, {
              prefix: "[S3_CLEANUP]: ",
              key: error.Key,
              code: error.Code,
              message: error.Message,
            });
          }
        }

        this.logger.info(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            s3Keys.length / BATCH_SIZE
          )} completed`,
          {
            prefix: "[S3_CLEANUP]: ",
            deletedInBatch: batchDeleted - (result.Errors?.length || 0),
            errorsInBatch: result.Errors?.length || 0,
            totalProgress: `${totalDeleted}/${s3Keys.length}`,
          }
        );
      } catch (error) {
        totalErrors += batch.length;
        this.logger.error(`Batch delete failed entirely`, {
          prefix: "[S3_CLEANUP]: ",
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info(
      `Completed S3 deletion: ${
        totalDeleted - totalErrors
      } succeeded, ${totalErrors} failed`,
      {
        prefix: "[S3_CLEANUP]: ",
        totalFiles: s3Keys.length,
        successCount: totalDeleted - totalErrors,
        errorCount: totalErrors,
      }
    );
  }

  /**
   * MinIO Compatibility Workaround for DeleteObjectsCommand
   *
   * PROBLEM:
   * MinIO bucket policies may require Content-MD5 headers for DeleteObjectsCommand,
   * even though AWS S3 doesn't require this. The AWS SDK v3 doesn't expose Content-MD5
   * in TypeScript types because modern AWS S3 uses newer checksum algorithms.
   *
   * SOLUTION:
   * 1. Build the exact XML body that AWS SDK will serialize and send
   * 2. Calculate MD5 hash of this XML body
   * 3. Inject Content-MD5 header via middleware after serialization step
   *
   * This approach:
   * - Uses AWS SDK v3's native middleware system
   * - Calculates correct MD5 matching the actual request body
   * - Doesn't break AWS S3 compatibility (extra header is ignored)
   * - Maintains batch deletion performance (1000 files per request)
   *
   * @param command DeleteObjectsCommand to modify
   * @param objects Array of objects to delete (used for MD5 calculation)
   */
  private _applyMinioContentMD5Workaround(
    command: DeleteObjectsCommand,
    objects: Array<{ Key: string }>
  ): void {
    // Build XML body matching AWS SDK's serialization format
    const xmlBody = this._buildDeleteXmlBody(objects);
    const contentMD5 = createHash("md5").update(xmlBody).digest("base64");

    // Inject Content-MD5 header via middleware after serialization
    // ? Using 'any' types because AWS SDK middleware types are not exported
    command.middlewareStack.addRelativeTo(
      (next: any) => async (args: any) => {
        if (args.request && args.request.headers) {
          args.request.headers["content-md5"] = contentMD5;
        }
        return next(args);
      },
      {
        relation: "after",
        toMiddleware: "serializerMiddleware",
        name: "addContentMD5Middleware",
      }
    );
  }

  /**
   * Build the XML body for DeleteObjects request
   * Must match AWS SDK's exact serialization format for correct MD5 calculation
   */
  private _buildDeleteXmlBody(objects: Array<{ Key: string }>): string {
    const objectsXml = objects
      .map(
        (obj) => `<Object><Key>${ValueUtils.escapeXml(obj.Key)}</Key></Object>`
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?><Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Quiet>true</Quiet>${objectsXml}</Delete>`;
  }

  private async _handleAvatarRemove(
    req: Request,
    filename: string,
    usage: UsageEntries
  ) {
    const user = await this.userService.getUserByRequest(req, {
      select: ["id"],
      relations: ["permissions"],
      relationSelects: { permissions: ["id", "name"] },
    });

    if (!user) {
      return false;
    }

    const hasPermission = await Permission.checkPermission(
      user,
      Permissions.DELETE_FILE
    );

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
        avatar: undefined,
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
   * @param count Number of random files to upload (default: 5)
   * @returns Array of uploaded filenames
   */
  public async uploadRandomTestFiles(count: number = 5): Promise<string[]> {
    this.logger.audit(`Uploading ${count} random test files to S3`, {
      prefix: "[S3StorageService]: ",
      count,
    });

    const uploadedFiles: string[] = [];

    for (let i = 0; i < count; i++) {
      const randomContent = this._generateRandomContent();
      const md5Hash = createHash("md5").update(randomContent).digest("hex");
      const filePath = StorageUtils.parseFilePath(md5Hash);

      const command = new PutObjectCommand({
        Bucket: this.s3Context.bucket,
        Key: filePath,
        Body: randomContent,
        ContentLength: Buffer.byteLength(randomContent),
      });

      try {
        await this._client.send(command);
        uploadedFiles.push(md5Hash);
        this.logger.trace(`Uploaded test file ${i + 1}/${count}: ${md5Hash}`, {
          prefix: "[S3StorageService]: ",
        });
      } catch (err) {
        this.logger.error(`Failed to upload test file ${i + 1}/${count}`, {
          prefix: "[S3StorageService]: ",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.audit(
      `Successfully uploaded ${uploadedFiles.length} test files to S3`,
      {
        prefix: "[S3StorageService]: ",
        uploadedCount: uploadedFiles.length,
        files: uploadedFiles,
      }
    );

    return uploadedFiles;
  }

  /**
   * Generates random content for test files
   */
  private _generateRandomContent(): Buffer {
    const size = Math.floor(Math.random() * 10000) + 1000; // 1KB to 10KB
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let content = "";

    for (let i = 0; i < size; i++) {
      content += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return Buffer.from(content, "utf8");
  }
}
