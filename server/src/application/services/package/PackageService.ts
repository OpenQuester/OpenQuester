import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import {
  PACKAGE_DETAILED_RELATIONS,
  PACKAGE_SELECT_FIELDS,
  PACKAGE_SELECT_RELATIONS
} from "domain/constants/package";
import { UPLOAD_PACKAGE_LINKS_EXPIRES_IN } from "domain/constants/storage";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { Package } from "infrastructure/database/models/package/Package";
import { type User } from "infrastructure/database/models/User";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";
import { ValueUtils } from "domain/utils/ValueUtils";
import { PackageStorageService } from "application/services/package/PackageStorageService";
import { UserSessionService } from "application/services/user/UserSessionService";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { StorageQuotaService } from "application/services/storage/StorageQuotaService";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { type PackageUploadStateDTO } from "domain/types/dto/package/PackageUploadStateDTO";
import { type PackageUploadRequestDTO } from "domain/types/dto/package/PackageUploadRequestDTO";
import { type PackageEditContext } from "application/types/package/PackageEditContext";

/**
 * Service for package management operations.
 */
@singleton()
export class PackageService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly packageStorageService: PackageStorageService,
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    private readonly userSessionService: UserSessionService,
    private readonly storageQuotaService: StorageQuotaService,
    private readonly storageCleanupService: StorageCleanupService,
    private readonly storageRepository: StorageRepository,
    private readonly packageUploadService: PackageUploadService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async getPackage(
    packId: string | number,
    select?: (keyof Package)[],
    relations?: string[]
  ): Promise<PackageDTO> {
    const pack = await this.getPackageRaw(packId, select, relations ?? PACKAGE_DETAILED_RELATIONS);
    if (pack.upload_status === PackageUploadStatus.UPLOADING) {
      // Uploaders that never report back (Flutter, scripts) would otherwise look
      // unfinished until the background check; ask storage while someone looks.
      try {
        pack.upload_status = (await this.packageUploadService.refresh(pack.id)).status;
      } catch {
        // Keep the stored status.
      }
    }
    return pack.toDTO(this.fileUrlBuilder, {
      fetchIds: true
    });
  }

  public async getPackageRaw(
    packId: string | number,
    select?: (keyof Package)[],
    relations?: string[]
  ): Promise<Package> {
    const id = ValueUtils.validateId(packId);
    const pack = await this.packageRepository.get(
      id,
      select ?? PACKAGE_SELECT_FIELDS,
      relations ?? PACKAGE_SELECT_RELATIONS
    );

    if (!pack) {
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return pack;
  }

  public async getCountsForPackage(packageId: number) {
    return this.packageRepository.getCountsForPackage(packageId);
  }

  public async searchPackages(
    searchOpts: PackageSearchOpts
  ): Promise<PaginatedResult<Omit<PackageDTO, "rounds">[]>> {
    const paginatedList = await this.packageRepository.search(searchOpts);

    const packageListItems = paginatedList.data.map((pack) => {
      return pack.toSimpleDTO(this.fileUrlBuilder);
    });

    return {
      data: packageListItems,
      pageInfo: { ...paginatedList.pageInfo }
    };
  }

  public async uploadPackage(
    author: User | null,
    request: PackageUploadRequestDTO,
    expiresIn: number = UPLOAD_PACKAGE_LINKS_EXPIRES_IN
  ): Promise<PackageUploadResponse> {
    if (!author || !author.id) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
    }

    const unverifiedFileSizes = await this.storageQuotaService.assertPackageFits(
      author,
      request.content,
      request.fileSizes
    );
    const { pack, files } = await this.packageRepository.create(request.content, author);
    await this.storageRepository.setDeclaredSizes(unverifiedFileSizes);
    const uploadStatus = await this.packageUploadService.markSaved(pack.id, request.sourceHash ?? null);

    const links = await this.packageStorageService.generateUploadLinks(files, expiresIn);
    return {
      id: pack.id,
      uploadLinks: links,
      uploadStatus
    };
  }

  public async uploadPackageForSession(
    sessionUserId: number | undefined,
    request: PackageUploadRequestDTO,
    expiresIn?: number
  ): Promise<PackageUploadResponse> {
    const author = await this.userSessionService.getValidatedSessionUser({
      sessionUserId
    });

    if (author.is_guest) {
      throw new ClientError(ClientResponse.CANNOT_UPLOAD_PACKAGE_AS_GUEST, HttpStatus.FORBIDDEN);
    }

    return this.uploadPackage(author, request, expiresIn);
  }

  /**
   * Replaces a package's content in place. Allowed for its author and for
   * users with EDIT_PACKAGE. Returns upload links for every file it uses;
   * files already in storage answer the upload with 412, which clients skip.
   */
  public async replacePackageContent(
    editContext: PackageEditContext,
    request: PackageUploadRequestDTO,
    expiresIn: number = UPLOAD_PACKAGE_LINKS_EXPIRES_IN
  ): Promise<PackageUploadResponse> {
    const { user, packageEntity } = editContext;
    const packageId = packageEntity.id;
    // Limits are the author's: an editor with EDIT_PACKAGE fixes someone else's package.
    const unverifiedFileSizes = await this.storageQuotaService.assertPackageFits(
      packageEntity.author ?? user,
      request.content,
      request.fileSizes,
      packageId
    );
    const previousFilenames = await this.storageRepository.getPackageFilenames(packageId);
    // The repository replaces content in place; package identity and original author stay intact.
    const { pack, files } = await this.packageRepository.create(request.content, user, packageId);
    await this.storageRepository.setDeclaredSizes(unverifiedFileSizes);
    // Media the edit dropped is deleted unless something else still uses it.
    await this.storageCleanupService.removeIfUnused(previousFilenames);
    const uploadStatus = await this.packageUploadService.markSaved(pack.id, request.sourceHash);
    const links = await this.packageStorageService.generateUploadLinks(files, expiresIn);
    return { id: pack.id, uploadLinks: links, uploadStatus };
  }

  /**
   * Which media files of a package storage still lacks, with fresh upload
   * links for them, so its author (or an EDIT_PACKAGE user) can finish an
   * interrupted upload. Checking also marks the package ready once complete.
   */
  public async getUploadStateForSession(
    sessionUserId: number | undefined,
    packageId: number
  ): Promise<PackageUploadStateDTO> {
    await this.assertCanEditPackage(sessionUserId, packageId);
    return this.packageUploadService.getState(packageId);
  }

  /**
   * Resolves an active, non-banned user and throws 403 unless they wrote the package or have
   * EDIT_PACKAGE. Middleware only verifies the session; public GET upload-state routes also
   * reach this check. Callers may reuse the loaded entities when replacing package content.
   */
  public async assertCanEditPackage(
    sessionUserId: number | undefined,
    packageId: number
  ): Promise<PackageEditContext> {
    const user = await this.userSessionService.getValidatedSessionUser({
      sessionUserId
    });
    const packageEntity = await this.getPackageRaw(packageId, ["id"], ["author"]);
    const isAuthor = packageEntity.author?.id === user.id;
    if (!isAuthor && !this.userSessionService.userHasPermission(user, Permissions.EDIT_PACKAGE)) {
      throw new ClientError(ClientResponse.NO_PERMISSION, HttpStatus.FORBIDDEN);
    }
    return { user, packageEntity };
  }

  public async canDeletePackage(input: {
    packageId: number;
    sessionUserId: number | undefined;
  }): Promise<boolean> {
    const user = await this.userSessionService.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    if (this.userSessionService.userHasPermission(user, Permissions.DELETE_PACKAGE)) {
      return true;
    }

    const packageEntity = await this.getPackageRaw(input.packageId, ["id"], ["author"]);

    return packageEntity.author?.id === user.id;
  }

  /**
   * Delete package and all related data including files and tags if not used elsewhere
   */
  public async deletePackage(packageId: number): Promise<void> {
    const { filesDeletedFromDB } = await this.packageRepository.deletePackageData(packageId);

    if (filesDeletedFromDB.length > 0) {
      try {
        await this.packageStorageService.deleteFiles(filesDeletedFromDB);
      } catch (error) {
        // Log error but don't fail the entire operation
        this.logger.error(`Failed to delete files from S3 in batch`, {
          prefix: LogPrefix.S3,
          filenames: filesDeletedFromDB,
          packageId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.audit(`Package ${packageId} deleted successfully`, {
      prefix: LogPrefix.ADMIN,
      packageId
    });
  }
}
