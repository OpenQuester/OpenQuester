import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type FileDTO } from "domain/types/dto/file/FileDTO";
import { type S3Context } from "domain/types/file/S3Context";
import { ValueUtils } from "domain/utils/ValueUtils";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type ObjectStorage } from "shared/storage/ObjectStorage";
import { StorageUtils } from "infrastructure/utils/StorageUtils";

const S3_DELETE_BATCH_SIZE = 1000;

/**
 * Handles package-specific object storage operations.
 */
@singleton()
export class PackageStorageService {
  constructor(
    @inject(DI_TOKENS.S3Context) private readonly s3Context: S3Context,
    @inject(DI_TOKENS.ObjectStorage) private readonly objectStorage: ObjectStorage,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Generate upload links for files declared by an uploaded package.
   */
  public async generateUploadLinks(
    files: FileDTO[],
    expiresIn: number
  ): Promise<Record<string, string>> {
    const links: Record<string, string> = {};

    for (const file of files) {
      const filename = ValueUtils.getRawFilename(file.filename.toLowerCase());
      links[filename] = await this.objectStorage.generatePresignedUrl({
        operation: "PUT",
        bucket: this.s3Context.bucket,
        key: `${file.path}${filename}`,
        expiresInSeconds: expiresIn,
        contentMd5Hex: filename
      });
    }

    return links;
  }

  /**
   * Delete package files from object storage in S3-compatible batches.
   */
  public async deleteFiles(filenames: string[]): Promise<void> {
    for (let i = 0; i < filenames.length; i += S3_DELETE_BATCH_SIZE) {
      const batch = filenames.slice(i, i + S3_DELETE_BATCH_SIZE);
      const keys = batch.map((filename) => StorageUtils.parseFilePath(filename));
      const result = await this.objectStorage.deleteObjects(this.s3Context.bucket, keys);

      for (const error of result.errors) {
        this.logger.error(`S3 batch delete partial failure`, {
          prefix: LogPrefix.S3,
          key: error.key,
          code: error.code,
          message: error.message
        });
      }
    }
  }
}
