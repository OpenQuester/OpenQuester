import { singleton } from "tsyringe";

import { S3StorageService } from "application/services/storage/S3StorageService";

/**
 * Application service for file storage workflows exposed through REST.
 */
@singleton()
export class FileStorageService {
  constructor(private readonly storage: S3StorageService) {
    //
  }

  public getUrl(filename: string): string {
    return this.storage.getUrl(filename);
  }

  public async upload(filename: string): Promise<string> {
    return this.storage.upload(filename);
  }

  public async delete(
    filename: string,
    sessionUserId: number | undefined
  ): Promise<void> {
    await this.storage.delete(filename, sessionUserId);
  }
}
