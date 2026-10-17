import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { StorageQuotaService } from "application/services/storage/StorageQuotaService";
import { PACKAGE_DETAILED_RELATIONS, PACKAGE_SELECT_FIELDS } from "domain/constants/package";
import { UPLOAD_PACKAGE_LINKS_EXPIRES_IN } from "domain/constants/storage";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { ClientError } from "domain/errors/ClientError";
import { type PackageUploadStateDTO } from "domain/types/dto/package/PackageUploadStateDTO";
import { type FileLocation } from "domain/types/file/FileLocation";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { Package } from "infrastructure/database/models/package/Package";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

const PARALLEL_CHECKS = 8;

/** Result of asking storage which media files of a package it holds. */
export interface UploadCheck {
  status: PackageUploadStatus;
  /** Every media file the package uses. */
  files: FileLocation[];
  /** Filenames (MD5s) storage said it doesn't have. */
  missingFilenames: string[];
  /** Filenames whose check failed (storage unreachable): neither stored nor missing. */
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
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /** Packages still uploading that were created since `since`, oldest first. */
  public async getUploadingSince(since: Date, limit: number): Promise<number[]> {
    return this.packageRepository.getUploadingSince(since, limit);
  }

  /**
   * After a package is created or replaced: ready when storage already holds
   * every file it uses (nothing new to upload), otherwise uploading.
   */
  public async markSaved(packageId: number): Promise<PackageUploadStatus> {
    return this.finalize(await this.getUploadPackage(packageId));
  }

  /** Asks storage about every file not confirmed yet and saves the result. */
  public async refresh(packageId: number): Promise<UploadCheck> {
    const pack = await this.getUploadPackage(packageId);
    const files = await this.storageRepository.getPackageFileStates(packageId);
    if (pack.upload_status === PackageUploadStatus.READY) {
      return {
        status: PackageUploadStatus.READY,
        files,
        missingFilenames: [],
        uncheckedFilenames: []
      };
    }
    const pendingFilenames = files.filter((file) => !file.verified).map((file) => file.filename);

    const missingFilenames: string[] = [];
    const uncheckedFilenames: string[] = [];

    // A few HEAD requests at a time, so a big package doesn't flood storage
    for (let i = 0; i < pendingFilenames.length; i += PARALLEL_CHECKS) {
      const chunk = pendingFilenames.slice(i, i + PARALLEL_CHECKS);

      await Promise.all(
        chunk.map(async (filename) => {
          try {
            const size = await this.storageQuotaService.verifyFile(filename);

            if (size === null) {
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

    const status =
      missingFilenames.length === 0 && uncheckedFilenames.length === 0
        ? await this.finalize(pack)
        : PackageUploadStatus.UPLOADING;
    if (status === PackageUploadStatus.READY) {
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

    const notStored = new Set([...check.missingFilenames, ...check.uncheckedFilenames]);
    const filesToUpload = check.files.filter((file) => notStored.has(file.filename));

    const links = await this.packageStorageService.generateUploadLinks(
      filesToUpload,
      UPLOAD_PACKAGE_LINKS_EXPIRES_IN
    );

    return {
      id: packageId,
      status: check.status,
      totalFiles: check.files.length,
      uploadedFiles: check.files.length - notStored.size,
      missing: [...notStored].map((filename) => filename.toLowerCase()),
      uploadLinks: links
    };
  }

  /**
   * Throws 409 unless every media file of the package is in storage. A
   * package marked uploading is checked again first, so a finished upload
   * from a client that never reported back still counts. Unconfirmed files
   * and exceeded measured quotas keep the package unplayable.
   */
  public async assertPlayable(packageId: number): Promise<void> {
    const pack = await this.packageRepository.get(packageId, ["id", "upload_status"], []);
    if (!pack || pack.upload_status !== PackageUploadStatus.UPLOADING) {
      return;
    }

    const check = await this.refresh(packageId);
    if (check.status === PackageUploadStatus.READY) {
      return;
    }

    throw new ClientError(ClientResponse.PACKAGE_UPLOAD_UNFINISHED, HttpStatus.CONFLICT, {
      missing: check.missingFilenames.length + check.uncheckedFilenames.length,
      total: check.files.length
    });
  }

  private async getUploadPackage(packageId: number): Promise<Package> {
    const pack = await this.packageRepository.get(
      packageId,
      [...PACKAGE_SELECT_FIELDS, "upload_started_at"],
      PACKAGE_DETAILED_RELATIONS
    );
    if (!pack) {
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return pack;
  }

  private async finalize(pack: Package): Promise<PackageUploadStatus> {
    if (pack.upload_status === PackageUploadStatus.READY) return PackageUploadStatus.READY;
    const files = await this.storageRepository.getPackageFileStates(pack.id);
    if (files.some((file) => !file.verified) || !pack.author) {
      return PackageUploadStatus.UPLOADING;
    }
    await this.storageQuotaService.assertStoredPackageFits(
      pack.author,
      {
        logo: pack.logoDTO(this.fileUrlBuilder),
        rounds: pack.rounds.map((round) => ({
          themes: round.themes.map((theme) => ({
            questions: theme.questions.map((question) =>
              question.toDTO(this.fileUrlBuilder, { fetchIds: false })
            )
          }))
        }))
      },
      pack.id
    );
    // A concurrent replacement must be checked using its own content and limits.
    return (await this.packageRepository.markUploadReady(pack.id, pack.upload_started_at))
      ? PackageUploadStatus.READY
      : PackageUploadStatus.UPLOADING;
  }
}
