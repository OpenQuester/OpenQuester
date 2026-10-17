import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { type GuestCleanupBatch } from "domain/types/storage/GuestCleanupTypes";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

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
    private readonly packageStore: PackageStore,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /** Of these MD5s, deletes the ones that lost their last use. Never throws. */
  public async removeIfUnused(filenames: string[]): Promise<string[]> {
    try {
      const unused = await this.storageRepository.filterUnused([...new Set(filenames)]);

      return await this.remove(unused);
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
    const deleted = await this.remove(unused);

    return deleted.length;
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

  /**
   * Deletes these files, except the ones a running game still shows: a game
   * plays from its own copy of the package, made when it was created, so an
   * edit to the package must not pull media out from under it. Those files
   * are left for a later cleanup. Returns the files actually deleted.
   */
  private async remove(filenames: string[]): Promise<string[]> {
    if (filenames.length === 0) {
      return [];
    }

    const inRunningGames = await this.packageStore.getFilenamesInRunningGames();
    const deletable = filenames.filter((filename) => !inRunningGames.has(filename));

    if (deletable.length === 0) {
      return [];
    }

    await this.storageRepository.deleteFileRows(deletable);
    await this.packageStorageService.deleteFiles(deletable);
    this.logger.info("Deleted unused files", { prefix: LogPrefix.S3, count: deletable.length });

    return deletable;
  }
}
