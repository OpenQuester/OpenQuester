import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { StorageQuotaService } from "application/services/storage/StorageQuotaService";
import { UPLOAD_PACKAGE_LINKS_EXPIRES_IN } from "domain/constants/storage";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { ClientError } from "domain/errors/ClientError";
import { type PackageUploadStateDTO } from "domain/types/dto/package/PackageUploadStateDTO";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const PARALLEL_CHECKS = 8;

interface UploadCheck {
  status: PackageUploadStatus;
  files: { filename: string; path: string }[];
  /** Files storage said it doesn't have. */
  missing: string[];
  /** Files whose check failed (storage unreachable); neither stored nor missing. */
  unknown: string[];
}

/**
 * Tracks whether every media file of a package reached storage. Clients
 * upload straight to storage with presigned links, so the server learns
 * a file arrived only by asking storage (HEAD); a confirmed file keeps its
 * `size_verified_at`, so each file is asked about until it is there.
 */
@singleton()
export class PackageUploadService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly storageRepository: StorageRepository,
    private readonly storageQuotaService: StorageQuotaService,
    private readonly packageStorageService: PackageStorageService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * After a package is created or replaced: ready when storage already holds
   * every file it uses (nothing new to upload), otherwise uploading.
   */
  public async markSaved(packageId: number, sourceHash?: string | null): Promise<PackageUploadStatus> {
    const files = await this.storageRepository.getPackageFileStates(packageId);
    const status = files.every((f) => f.verified)
      ? PackageUploadStatus.READY
      : PackageUploadStatus.UPLOADING;
    await this.packageRepository.setUploadState(packageId, status, sourceHash);
    return status;
  }

  /** Asks storage about every file not confirmed yet and saves the result. */
  public async refresh(packageId: number): Promise<UploadCheck> {
    const pack = await this.packageRepository.get(packageId, ["id", "upload_status"], []);
    if (!pack) throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);

    const files = await this.storageRepository.getPackageFileStates(packageId);
    const pending = files.filter((f) => !f.verified).map((f) => f.filename);
    const missing: string[] = [];
    const unknown: string[] = [];
    for (let i = 0; i < pending.length; i += PARALLEL_CHECKS) {
      await Promise.all(
        pending.slice(i, i + PARALLEL_CHECKS).map(async (filename) => {
          try {
            if ((await this.storageQuotaService.verifyFile(filename)) === null) missing.push(filename);
          } catch (error) {
            unknown.push(filename);
            this.logger.warn("Could not check a package file in storage", {
              prefix: LogPrefix.S3,
              packageId,
              filename,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        })
      );
    }

    let status = pack.upload_status;
    if (missing.length > 0) status = PackageUploadStatus.UPLOADING;
    else if (unknown.length === 0) status = PackageUploadStatus.READY;
    if (status !== pack.upload_status) {
      await this.packageRepository.setUploadState(packageId, status);
      this.logger.info(`Package ${packageId} upload is ${status}`, {
        prefix: LogPrefix.S3,
        packageId,
        missing: missing.length
      });
    }
    return { status, files, missing, unknown };
  }

  /** The upload state with fresh links for the files still missing. */
  public async getState(packageId: number): Promise<PackageUploadStateDTO> {
    const check = await this.refresh(packageId);
    const notStored = new Set([...check.missing, ...check.unknown]);
    const links = await this.packageStorageService.generateUploadLinks(
      check.files
        .filter((f) => notStored.has(f.filename))
        .map((f) => ({ filename: f.filename, path: f.path })),
      UPLOAD_PACKAGE_LINKS_EXPIRES_IN
    );
    return {
      id: packageId,
      status: check.status,
      totalFiles: check.files.length,
      uploadedFiles: check.files.length - notStored.size,
      missing: [...notStored].map((f) => f.toLowerCase()),
      uploadLinks: links
    };
  }

  /**
   * Throws 409 unless every media file of the package is in storage. A
   * package marked uploading is checked again first, so a finished upload
   * from a client that never reported back still counts. When storage
   * can't be reached, only files it confirmed missing block the game.
   */
  public async assertPlayable(packageId: number): Promise<void> {
    const pack = await this.packageRepository.get(packageId, ["id", "upload_status"], []);
    if (!pack || pack.upload_status !== PackageUploadStatus.UPLOADING) return;
    const check = await this.refresh(packageId);
    if (check.missing.length === 0) return;
    throw new ClientError(ClientResponse.PACKAGE_UPLOAD_UNFINISHED, HttpStatus.CONFLICT, {
      missing: check.missing.length,
      total: check.files.length
    });
  }
}
