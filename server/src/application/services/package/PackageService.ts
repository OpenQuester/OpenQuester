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
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async getPackage(
    packId: string | number,
    select?: (keyof Package)[],
    relations?: string[]
  ): Promise<PackageDTO> {
    return (
      await this.getPackageRaw(packId, select, relations ?? PACKAGE_DETAILED_RELATIONS)
    ).toDTO(this.fileUrlBuilder, {
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
    expiresIn: number = UPLOAD_PACKAGE_LINKS_EXPIRES_IN
  ): Promise<PackageUploadResponse> {
    if (!author || !author.id) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
    }

    const { pack, files } = await this.packageRepository.create(packageData, author);

    const links = await this.packageStorageService.generateUploadLinks(files, expiresIn);
    return {
      id: pack.id,
      uploadLinks: links
    };
  }

  public async uploadPackageForSession(input: {
    sessionUserId: number | undefined;
    packageData: PackageDTO;
    expiresIn?: number;
  }): Promise<PackageUploadResponse> {
    const author = await this.userSessionService.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    if (author.is_guest) {
      throw new ClientError(ClientResponse.CANNOT_UPLOAD_PACKAGE_AS_GUEST, HttpStatus.FORBIDDEN);
    }

    return this.uploadPackage(author, input.packageData, input.expiresIn);
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
