import {
  DeleteObjectCommand,
  GetObjectCommand,
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
    const startTime = Date.now();
    this.logger.trace(`Discord file upload started for ${filename}`, {
      prefix: "[S3StorageService]: ",
      cdnLink,
      filename,
    });

    return new Promise((resolve) => {
      https
        .get(cdnLink, (res) => {
          if (res.statusCode !== 200) {
            const fetchTime = Date.now() - startTime;
            this.logger.error(
              `Failed to fetch file from CDN (${cdnLink}): ${res.statusCode}`,
              {
                prefix: "[S3StorageService]: ",
                fetchTime,
                statusCode: res.statusCode,
              }
            );
            resolve(false);
            return;
          }

          const chunks: Buffer[] = [];

          res.on("data", (chunk) => {
            chunks.push(chunk);
          });

          res.on("end", async () => {
            const fileBuffer = Buffer.concat(chunks);
            const fetchTime = Date.now() - startTime;

            this.logger.performance(`Discord file fetched in ${fetchTime}ms`, {
              prefix: "[S3StorageService]: ",
              fetchTime,
              fileSize: fileBuffer.length,
              filename,
            });

            const md5Hash = createHash("md5").update(fileBuffer).digest("hex");

            const command = new PutObjectCommand({
              Bucket: this.s3Context.bucket,
              Key: StorageUtils.parseFilePath(md5Hash),
              Body: fileBuffer,
              ContentLength: fileBuffer.length,
            });

            try {
              const uploadStartTime = Date.now();
              await this._client.send(command);
              const uploadTime = Date.now() - uploadStartTime;
              const totalTime = Date.now() - startTime;

              this.logger.performance(
                `Discord file uploaded to S3 in ${uploadTime}ms (total: ${totalTime}ms)`,
                {
                  prefix: "[S3StorageService]: ",
                  uploadTime,
                  totalTime,
                  fileSize: fileBuffer.length,
                  filename,
                  md5Hash,
                }
              );

              resolve(md5Hash);
            } catch (err) {
              const totalTime = Date.now() - startTime;
              this.logger.error(
                TemplateUtils.text(ServerResponse.BUCKET_UPLOAD_FAILED, {
                  filename,
                  err,
                }),
                {
                  prefix: "[S3StorageService]: ",
                  totalTime,
                  errorMessage: err,
                }
              );
              resolve(false);
            }
          });
        })
        .on("error", (err) => {
          const totalTime = Date.now() - startTime;
          this.logger.error(
            TemplateUtils.text(ServerResponse.BUCKET_UPLOAD_FAILED, {
              cdnLink,
              err,
            }),
            {
              prefix: "[S3StorageService]: ",
              totalTime,
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

    const filePath = StorageUtils.parseFilePath(filename);
    await this.fileService.removeFile(filename);

    const command = new DeleteObjectCommand({
      Bucket: this.s3Context.bucket,
      Key: filePath,
    });
    await this._client.send(command);
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
}
