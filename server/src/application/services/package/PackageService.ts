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
import { type ClientFileSizes } from "domain/types/storage/StorageTypes";

/**
 * Service for package management operations.
 */
/** A package together with the session user who is allowed to edit it. */
export interface EditablePackage {
  user: User;
  pack: Package;
}

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
    packageData: PackageDTO,
    expiresIn: number = UPLOAD_PACKAGE_LINKS_EXPIRES_IN,
    fileSizes?: ClientFileSizes,
    sourceHash?: string | null
  ): Promise<PackageUploadResponse> {
    if (!author || !author.id) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
    }

    const newFileSizes = await this.storageQuotaService.assertPackageFits(
      author,
      packageData,
      fileSizes
    );

    const { pack, files } = await this.packageRepository.create(packageData, author);
    await this.storageRepository.setDeclaredSizes(newFileSizes);
    const uploadStatus = await this.packageUploadService.markSaved(pack.id, sourceHash ?? null);

    const links = await this.packageStorageService.generateUploadLinks(files, expiresIn);
    return {
      id: pack.id,
      uploadLinks: links,
      uploadStatus
    };
  }

  public async uploadPackageForSession(input: {
    sessionUserId: number | undefined;
    packageData: PackageDTO;
    expiresIn?: number;
    fileSizes?: ClientFileSizes;
    sourceHash?: string | null;
  }): Promise<PackageUploadResponse> {
    const author = await this.userSessionService.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    if (author.is_guest) {
      throw new ClientError(ClientResponse.CANNOT_UPLOAD_PACKAGE_AS_GUEST, HttpStatus.FORBIDDEN);
    }

    return this.uploadPackage(
      author,
      input.packageData,
      input.expiresIn,
      input.fileSizes,
      input.sourceHash
    );
  }

  /**
   * Saves an edited package over the stored one (same id), for its author or
   * a user with EDIT_PACKAGE (`editable`, from {@link getEditablePackage}).
   *
   * Steps: check the new content fits the author's storage limits, replace the
   * package rows, remember the sizes of new media, delete media the edit
   * dropped (unless something else uses it), mark the package as uploading
   * again and hand out upload links. Links come for every file the package
   * uses; files already in storage answer the upload with 412, which clients
   * skip.
   */
  public async updatePackageForSession(input: {
    editable: EditablePackage;
    packageData: PackageDTO;
    expiresIn?: number;
    fileSizes?: ClientFileSizes;
    /** Undefined keeps the stored fingerprint; an edited package sends null. */
    sourceHash?: string | null;
  }): Promise<PackageUploadResponse> {
    const { user, pack: stored } = input.editable;

    // Limits are the author's: an editor with EDIT_PACKAGE fixes someone else's package
    const newFileSizes = await this.storageQuotaService.assertPackageFits(
      stored.author ?? user,
      input.packageData,
      input.fileSizes,
      stored.id
    );

    const filenamesBefore = await this.storageRepository.getPackageFilenames(stored.id);
    const { pack, files } = await this.packageRepository.create(
      input.packageData,
      user,
      stored.id
    );

    await this.storageRepository.setDeclaredSizes(newFileSizes);
    await this.storageCleanupService.removeIfUnused(filenamesBefore);

    const uploadStatus = await this.packageUploadService.markSaved(pack.id, input.sourceHash);
    const links = await this.packageStorageService.generateUploadLinks(
      files,
      input.expiresIn ?? UPLOAD_PACKAGE_LINKS_EXPIRES_IN
    );

    return { id: pack.id, uploadLinks: links, uploadStatus };
  }

  /**
   * Which media files of a package storage still lacks, with fresh upload
   * links for them, so its author (or an EDIT_PACKAGE user) can finish an
   * interrupted upload. Checking also marks the package ready once complete.
   */
  public async getUploadStateForSession(input: {
    sessionUserId: number | undefined;
    packageId: number;
  }): Promise<PackageUploadStateDTO> {
    await this.assertCanEditPackage(input);

    return this.packageUploadService.getState(input.packageId);
  }

  /**
   * The session user and the package, once it is clear the user may edit it:
   * they wrote it or have EDIT_PACKAGE. Throws 403 otherwise.
   *
   * The session user is re-read and checked here because an account can be
   * banned or deleted while its session is still alive; the session
   * middleware only checks that a session exists.
   */
  public async getEditablePackage(input: {
    sessionUserId: number | undefined;
    packageId: number;
  }): Promise<EditablePackage> {
    const user = await this.userSessionService.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    const pack = await this.getPackageRaw(input.packageId, ["id"], ["author"]);

    const isAuthor = pack.author?.id === user.id;
    if (!isAuthor && !this.userSessionService.userHasPermission(user, Permissions.EDIT_PACKAGE)) {
      throw new ClientError(ClientResponse.NO_PERMISSION, HttpStatus.FORBIDDEN);
    }

    return { user, pack };
  }

  /** Throws 403 unless the session user wrote the package or has EDIT_PACKAGE. */
  public async assertCanEditPackage(input: {
    sessionUserId: number | undefined;
    packageId: number;
  }): Promise<void> {
    await this.getEditablePackage(input);
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
