import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type S3Context } from "domain/types/file/S3Context";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { StorageUtils } from "infrastructure/utils/StorageUtils";

/**
 * Builds public URLs for files stored in an S3-compatible bucket.
 */
@singleton()
export class S3FileUrlBuilder implements IFileUrlBuilder {
  constructor(@inject(DI_TOKENS.S3Context) private readonly s3Context: S3Context) {
    //
  }

  public getUrl(filename: string): string {
    const filePath = StorageUtils.parseFilePath(filename);

    if (this.s3Context.useSubDomainBucketFormat) {
      const baseUrl = this.s3Context.urlPrefix.endsWith("/")
        ? this.s3Context.urlPrefix.slice(0, -1)
        : this.s3Context.urlPrefix;
      return `${baseUrl}/${filePath}`;
    }

    const endpoint = this.s3Context.endpoint.endsWith("/")
      ? this.s3Context.endpoint.slice(0, -1)
      : this.s3Context.endpoint;
    return `${endpoint}/${this.s3Context.bucket}/${filePath}`;
  }
}
