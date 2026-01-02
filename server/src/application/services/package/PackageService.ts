import { type Request } from "express";

import { PackageTagService } from "application/services/package/PackageTagService";
import {
  PACKAGE_DETAILED_RELATIONS,
  PACKAGE_SELECT_FIELDS,
  PACKAGE_SELECT_RELATIONS,
} from "domain/constants/package";
import { UPLOAD_PACKAGE_LINKS_EXPIRES_IN } from "domain/constants/storage";
import { USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { SelectOptions } from "domain/types/SelectOptions";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { DependencyService } from "infrastructure/services/dependency/DependencyService";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { UserService } from "../user/UserService";

export class PackageService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly userService: UserService,
    private readonly storage: S3StorageService,
    private readonly packageTagService: PackageTagService,
    private readonly dependencyService: DependencyService,
    private readonly logger: ILogger
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
      throw new ClientError(
        ClientResponse.PACKAGE_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
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

  /**
   * Delete package and all related data including files and tags if not used elsewhere
   */
  public async deletePackage(packageId: number): Promise<void> {
    // Pre-transaction preparation to avoid scope issues
    let filesToDelete: string[] = [];
    let filesDeletedFromDB: string[] = [];

    await this.packageRepository.executeInTransaction(async (transaction) => {
      // Step 1: Get the package with all its data using transaction manager
      const packageEntity = await transaction.findOne(Package, {
        where: { id: packageId },
        relations: [
          "logo",
          "rounds",
          "rounds.themes",
          "rounds.themes.questions",
          "rounds.themes.questions.questionFiles",
          "rounds.themes.questions.questionFiles.file",
          "rounds.themes.questions.answerFiles",
          "rounds.themes.questions.answerFiles.file",
          "rounds.themes.questions.answers",
          "rounds.themes.questions.answers.file",
          "tags",
        ],
      });

      if (!packageEntity) {
        throw new ClientError(
          ClientResponse.PACKAGE_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }

      // Step 2: Collect all files used by this package
      const allFiles: { filename: string; id: number }[] = [];

      // Add logo file if exists
      if (packageEntity.logo) {
        allFiles.push({
          filename: packageEntity.logo.filename,
          id: packageEntity.logo.id,
        });
      }

      // Add all question and answer files
      packageEntity.rounds?.forEach((round) => {
        round.themes?.forEach((theme) => {
          theme.questions?.forEach((question) => {
            question.questionFiles?.forEach((qf) => {
              if (qf.file) {
                allFiles.push({
                  filename: qf.file.filename,
                  id: qf.file.id,
                });
              }
            });
            question.answerFiles?.forEach((af) => {
              if (af.file) {
                allFiles.push({
                  filename: af.file.filename,
                  id: af.file.id,
                });
              }
            });
            // Add files from choice answers
            question.answers?.forEach((answer) => {
              if (answer.file) {
                allFiles.push({
                  filename: answer.file.filename,
                  id: answer.file.id,
                });
              }
            });
          });
        });
      });

      // Step 3: Check file usage and create filesToDelete array (using bulk operations)
      filesToDelete = []; // Reset the array
      const filenames = allFiles.map((file) => file.filename);
      const allFileUsageMap = await this.dependencyService.getBulkFileUsage(
        filenames
      );

      for (const file of allFiles) {
        const usageRecords = allFileUsageMap.get(file.filename) || [];

        // Check if file is used only by this package
        const usedByOtherPackages = usageRecords.some(
          (usage) => usage.package && usage.package.id !== packageId
        );
        const usedByUsers = usageRecords.some((usage) => usage.user);

        if (!usedByOtherPackages && !usedByUsers) {
          filesToDelete.push(file.filename);
        }
      }

      // Step 4: Collect package tags and check usage (using bulk operations)
      const tagsToDelete: PackageTag[] = [];
      if (packageEntity.tags) {
        const tagIds = packageEntity.tags.map((tag) => tag.id);
        const tagUsageCountsMap =
          await this.packageTagService.getBulkTagUsageCounts(tagIds);

        for (const tag of packageEntity.tags) {
          const tagUsageCount = tagUsageCountsMap.get(tag.id) || 0;
          if (tagUsageCount <= 1) {
            // Only used by this package
            tagsToDelete.push(tag);
          }
        }
      }

      // Step 5: Delete file usage for files that will be completely deleted (BULK DELETE OPTIMIZATION)
      const fileIdsToDeleteUsage: number[] = [];
      for (const filename of filesToDelete) {
        const usageRecords = allFileUsageMap.get(filename) || [];
        // Find this package's usage record and collect file ID
        const thisPackageUsage = usageRecords.find(
          (record) => record.package?.id === packageEntity.id
        );
        if (thisPackageUsage?.file) {
          fileIdsToDeleteUsage.push(thisPackageUsage.file.id);
        }
      }

      // Bulk delete all file usage records for this package in a single query
      if (fileIdsToDeleteUsage.length > 0) {
        await transaction
          .createQueryBuilder()
          .delete()
          .from("file_usage")
          .where("file_id IN (:...fileIds) AND package_id = :packageId", {
            fileIds: fileIdsToDeleteUsage,
            packageId: packageEntity.id,
          })
          .execute();
      }

      // Step 6: Delete package and related data in transaction
      await this.packageTagService.deleteTagsInTransaction(
        transaction,
        tagsToDelete
      );
      await this.packageRepository.deleteInTransaction(
        transaction,
        packageEntity
      );

      // Step 7: Delete files from database within transaction
      filesDeletedFromDB = [];
      for (const filename of filesToDelete) {
        const originalUsageRecords = allFileUsageMap.get(filename) || [];
        const nonPackageUsageRecords = originalUsageRecords.filter(
          (record) => !record.package || record.package.id !== packageEntity.id
        );

        if (nonPackageUsageRecords.length === 0) {
          // No remaining usage - safe to delete from DB
          await transaction
            .createQueryBuilder()
            .delete()
            .from("file")
            .where("filename = :filename", { filename })
            .execute();

          filesDeletedFromDB.push(filename);
        }
      }
    });

    // Step 8: Delete files from S3 storage in batch (only for files that were deleted from DB)
    if (filesDeletedFromDB.length > 0) {
      try {
        await this.storage.deleteFilesFromStorage(filesDeletedFromDB);
      } catch (error) {
        // Log error but don't fail the entire operation
        this.logger.error(`Failed to delete files from S3 in batch`, {
          prefix: LogPrefix.S3,
          filenames: filesDeletedFromDB,
          packageId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.audit(`Package ${packageId} deleted successfully`, {
      prefix: LogPrefix.ADMIN,
      packageId,
    });
  }
}
