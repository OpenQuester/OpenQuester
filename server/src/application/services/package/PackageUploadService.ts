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
import { type StorageFile } from "domain/types/file/StorageFile";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const PARALLEL_CHECKS = 8;

interface PackageUploadCheck {
  status: PackageUploadStatus;
  files: StorageFile[];
  /** Files storage said it doesn't have. */
  missingFilenames: string[];
  /** Files whose check failed (storage unreachable); neither stored nor missing. */
  uncheckedFilenames: string[];
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
    const status = files.every((file) => file.verified)
      ? PackageUploadStatus.READY
      : PackageUploadStatus.UPLOADING;
    await this.packageRepository.setUploadState(packageId, status, sourceHash);
    return status;
  }

  /** Asks storage about every file not confirmed yet and saves the result. */
  public async refresh(packageId: number): Promise<PackageUploadCheck> {
    const pack = await this.packageRepository.get(packageId, ["id", "upload_status"], []);
    if (!pack) {
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const files = await this.storageRepository.getPackageFileStates(packageId);
    const pendingFilenames = files.filter((file) => !file.verified).map((file) => file.filename);
    const missingFilenames: string[] = [];
    const uncheckedFilenames: string[] = [];
    for (let i = 0; i < pendingFilenames.length; i += PARALLEL_CHECKS) {
      await Promise.all(
        pendingFilenames.slice(i, i + PARALLEL_CHECKS).map(async (filename) => {
          try {
            if ((await this.storageQuotaService.verifyFile(filename)) === null) {
              missingFilenames.push(filename);
            }
          } catch (error) {
            uncheckedFilenames.push(filename);
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
    if (missingFilenames.length > 0) {
      status = PackageUploadStatus.UPLOADING;
    } else if (uncheckedFilenames.length === 0) {
      status = PackageUploadStatus.READY;
    }
    if (status !== pack.upload_status) {
      await this.packageRepository.setUploadState(packageId, status);
      this.logger.info(`Package ${packageId} upload is ${status}`, {
        prefix: LogPrefix.S3,
        packageId,
        missing: missingFilenames.length
      });
    }
    return { status, files, missingFilenames, uncheckedFilenames };
  }

  /** The upload state with fresh links for the files still missing. */
  public async getState(packageId: number): Promise<PackageUploadStateDTO> {
    const check = await this.refresh(packageId);
    const notStoredFilenames = new Set([...check.missingFilenames, ...check.uncheckedFilenames]);
    const links = await this.packageStorageService.generateUploadLinks(
      check.files.filter((file) => notStoredFilenames.has(file.filename)),
      UPLOAD_PACKAGE_LINKS_EXPIRES_IN
    );
    return {
      id: packageId,
      status: check.status,
      totalFiles: check.files.length,
      uploadedFiles: check.files.length - notStoredFilenames.size,
      missing: [...notStoredFilenames].map((filename) => filename.toLowerCase()),
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
    if (!pack || pack.upload_status !== PackageUploadStatus.UPLOADING) {
      return;
    }
    const check = await this.refresh(packageId);
    if (check.missingFilenames.length === 0) {
      return;
    }
    throw new ClientError(ClientResponse.PACKAGE_UPLOAD_UNFINISHED, HttpStatus.CONFLICT, {
      missing: check.missingFilenames.length,
      total: check.files.length
    });
  }
}
