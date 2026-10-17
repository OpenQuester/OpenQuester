import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { type GuestCleanupBatch } from "domain/types/storage/GuestCleanupTypes";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/** Files younger than this are never treated as unused: an upload may still be under way. */
export const UNUSED_FILE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes stored files nothing uses any more: after a package edit or an
 * avatar change right away, and nightly for anything left behind.
 */
@singleton()
export class StorageCleanupService {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly packageStorageService: PackageStorageService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /** Of these MD5s, deletes the ones that lost their last use. Never throws. */
  public async removeIfUnused(filenames: string[]): Promise<string[]> {
    try {
      const unused = await this.storageRepository.filterUnused([...new Set(filenames)]);
      await this.remove(unused);

      return unused;
    } catch (error) {
      this.logger.error("Failed to clean up unused files", {
        prefix: LogPrefix.S3,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /** Every unused file older than the grace period. */
  public async removeAllUnused(): Promise<number> {
    const unused = await this.storageRepository.getUnusedFilenames(
      new Date(Date.now() - UNUSED_FILE_GRACE_MS)
    );
    await this.remove(unused);

    return unused.length;
  }

  /** Removes one guest batch, then deletes only avatars with no remaining references. */
  public async removeInactiveGuests(before: Date, limit: number): Promise<GuestCleanupBatch> {
    const batch = await this.storageRepository.removeInactiveGuests(before, limit);
    await this.removeIfUnused(batch.avatarFilenames);

    return batch;
  }

  /** Saves sizes measured by the bucket listing, overriding uploader declarations. */
  public async recordVerifiedSizes(sizes: Map<string, number>): Promise<void> {
    await this.storageRepository.setVerifiedSizes(sizes);
  }

  private async remove(filenames: string[]): Promise<void> {
    if (filenames.length === 0) {
      return;
    }

    await this.storageRepository.deleteFileRows(filenames);
    await this.packageStorageService.deleteFiles(filenames);
    this.logger.info("Deleted unused files", { prefix: LogPrefix.S3, count: filenames.length });
  }
}
