import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { PackageUploadRefreshGate } from "application/services/package/PackageUploadRefreshGate";
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

const PARALLEL_CHECKS = 4;
const CHECK_BUDGET_MS = 20_000;
type UploadVersion = Pick<Package, "upload_status" | "upload_started_at">;

/** Result of asking storage which media files of a package it holds. */
interface UploadCheck {
  status: PackageUploadStatus;
  files: FileLocation[];
  pending: Set<string>;
  startedAt: number | null;
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
    private readonly refreshGate: PackageUploadRefreshGate,
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /** Recent unfinished uploads in ascending package ID order. */
  public async getUploadingSince(since: Date, limit: number, afterId: number): Promise<number[]> {
    return this.packageRepository.getUploadingSince(since, limit, afterId);
  }

  /**
   * After a package is created or replaced: ready when storage already holds
   * every file it uses (nothing new to upload), otherwise uploading.
   */
  public async markSaved(packageId: number): Promise<PackageUploadStatus> {
    return this.finalize(await this.getUploadPackage(packageId));
  }

  /** Checks unconfirmed files within the shared admission and time limits. */
  public async refresh(packageId: number): Promise<UploadCheck> {
    const version = await this.getUploadVersion(packageId);
    const startedAt = version.upload_started_at?.getTime() ?? null;
    if (version.upload_status === PackageUploadStatus.READY) {
      return {
        status: PackageUploadStatus.READY,
        files: await this.storageRepository.getPackageFileStates(packageId),
        pending: new Set(),
        startedAt
      };
    }

    // Start the budget before acquiring the lease so a delayed Redis reply cannot extend it.
    const deadline = performance.now() + CHECK_BUDGET_MS;
    const release = await this.refreshGate.acquire(packageId, startedAt);
    let status = PackageUploadStatus.UPLOADING;
    try {
      const files = await this.storageRepository.getPackageFileStates(packageId);
      await this.assertUploadVersion(packageId, startedAt);
      const pending = new Set(files.filter((file) => !file.verified).map((file) => file.filename));
      await this.checkFiles(packageId, pending, deadline);

      if (pending.size === 0) {
        const pack = await this.getUploadPackage(packageId);
        this.assertSameVersion(pack, startedAt);
        status = await this.finalize(pack);
        if (status === PackageUploadStatus.READY) {
          this.logger.info("Package upload is ready", { prefix: LogPrefix.S3, packageId });
        }
      }
      return { status, files, pending, startedAt };
    } catch (error) {
      await this.assertUploadVersion(packageId, startedAt);
      throw error;
    } finally {
      await release(status !== PackageUploadStatus.READY);
    }
  }

  /** The upload state with fresh links for the files still missing. */
  public async getState(packageId: number): Promise<PackageUploadStateDTO> {
    const check = await this.refresh(packageId);
    const filesToUpload = check.files.filter((file) => check.pending.has(file.filename));

    const links = await this.packageStorageService.generateUploadLinks(
      filesToUpload,
      UPLOAD_PACKAGE_LINKS_EXPIRES_IN
    );
    await this.assertUploadVersion(packageId, check.startedAt);

    return {
      id: packageId,
      status: check.status,
      totalFiles: check.files.length,
      uploadedFiles: check.files.length - check.pending.size,
      missing: [...check.pending].map((filename) => filename.toLowerCase()),
      uploadLinks: links
    };
  }

  /** Games only use packages whose upload has been confirmed already. */
  public async assertPlayable(packageId: number): Promise<void> {
    const pack = await this.packageRepository.get(packageId, ["id", "upload_status"], []);
    if (!pack || pack.upload_status !== PackageUploadStatus.UPLOADING) {
      return;
    }

    const files = await this.storageRepository.getPackageFileStates(packageId);
    throw new ClientError(ClientResponse.PACKAGE_UPLOAD_UNFINISHED, HttpStatus.CONFLICT, {
      missing: files.filter((file) => !file.verified).length,
      total: files.length
    });
  }

  private async checkFiles(packageId: number, pending: Set<string>, deadline: number): Promise<void> {
    const pendingFilenames = [...pending];
    const signal = AbortSignal.timeout(Math.max(0, Math.ceil(deadline - performance.now())));
    for (let i = 0; i < pendingFilenames.length; i += PARALLEL_CHECKS) {
      if (signal.aborted || performance.now() >= deadline) {
        break;
      }
      const chunk = pendingFilenames.slice(i, i + PARALLEL_CHECKS);

      await Promise.all(
        chunk.map(async (filename) => {
          try {
            const size = await this.storageQuotaService.verifyFile(filename, signal);
            if (size !== null) {
              pending.delete(filename);
            }
          } catch (error) {
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
  }

  private async getUploadVersion(packageId: number): Promise<UploadVersion> {
    const pack = await this.packageRepository.get(
      packageId,
      ["id", "upload_status", "upload_started_at"],
      []
    );
    if (!pack) {
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return pack;
  }

  private async assertUploadVersion(packageId: number, startedAt: number | null): Promise<void> {
    this.assertSameVersion(await this.getUploadVersion(packageId), startedAt);
  }

  private assertSameVersion(pack: UploadVersion, startedAt: number | null): void {
    if ((pack.upload_started_at?.getTime() ?? null) !== startedAt) {
      throw new ClientError(ClientResponse.PACKAGE_UPLOAD_CHECK_BUSY, HttpStatus.TOO_MANY_REQUESTS);
    }
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
    if (pack.upload_status === PackageUploadStatus.READY) {
      return PackageUploadStatus.READY;
    }
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
