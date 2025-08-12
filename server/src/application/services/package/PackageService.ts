import { type Request } from "express";

import {
  PACKAGE_DETAILED_RELATIONS,
  PACKAGE_SELECT_FIELDS,
  PACKAGE_SELECT_RELATIONS,
} from "domain/constants/package";
import { UPLOAD_PACKAGE_LINKS_EXPIRES_IN } from "domain/constants/storage";
import { USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PackagePaginationOpts } from "domain/types/pagination/package/PackagePaginationOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { SelectOptions } from "domain/types/SelectOptions";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { UserService } from "../user/UserService";

export class PackageService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly userService: UserService,
    private readonly storage: S3StorageService
  ) {
    //
  }

  public async getPackage(
    packId: string | number,
    select?: (keyof Package)[],
    relations?: string[]
  ): Promise<PackageDTO> {
    return (
      await this.getPackageRaw(
        packId,
        select,
        relations ?? PACKAGE_DETAILED_RELATIONS
      )
    ).toDTO(this.storage, {
      fetchIds: true,
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
      throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND);
    }

    return pack;
  }

  public async getCountsForPackage(packageId: number) {
    return this.packageRepository.getCountsForPackage(packageId);
  }

  public async listPackages(
    paginationOpts: PackagePaginationOpts
  ): Promise<PaginatedResult<Omit<PackageDTO, "rounds">[]>> {
    const paginatedList = await this.packageRepository.list(paginationOpts);

    const packageListItems = paginatedList.data.map((pack) => {
      return pack.toSimpleDTO(this.storage);
    });

    return {
      data: packageListItems,
      pageInfo: { ...paginatedList.pageInfo },
    };
  }

  public findByIds(
    ids: number[],
    selectOptions: SelectOptions<Package>
  ): Promise<Package[]> {
    return this.packageRepository.findByIds(ids, selectOptions);
  }

  public async uploadPackage(
    req: Request,
    packageData: PackageDTO,
    expiresIn: number = UPLOAD_PACKAGE_LINKS_EXPIRES_IN
  ): Promise<PackageUploadResponse> {
    const author = await this.userService.getUserByRequest(req, {
      select: USER_SELECT_FIELDS,
      relations: [],
    });

    if (!author || !author.id) {
      throw new ClientError(ClientResponse.PACKAGE_AUTHOR_NOT_FOUND);
    }

    const { pack, files } = await this.packageRepository.create(
      packageData,
      author
    );

    const links = await this.storage.generatePresignedUrls(files, expiresIn);
    return {
      id: pack.id,
      uploadLinks: links,
    };
  }
}
