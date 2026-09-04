import { inject, singleton } from "tsyringe";
import { EntityManager, In, Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { SelectOptions } from "domain/types/SelectOptions";
import { Database } from "infrastructure/database/Database";
import { File } from "infrastructure/database/models/File";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { PackageQuestionChoiceAnswer } from "infrastructure/database/models/package/PackageQuestionChoiceAnswer";
import { PackageQuestionFile } from "infrastructure/database/models/package/PackageQuestionFile";
import { PackageRound } from "infrastructure/database/models/package/PackageRound";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { PackageTheme } from "infrastructure/database/models/package/PackageTheme";
import { User } from "infrastructure/database/models/User";
import { StorageUtils } from "infrastructure/utils/StorageUtils";
import { ValueUtils } from "domain/utils/ValueUtils";
import { PackageSearchQueryHelper } from "infrastructure/database/repositories/PackageSearchQueryHelper";
import { PackageTagRepository } from "infrastructure/database/repositories/PackageTagRepository";
import { PackageStatus } from "domain/enums/package/PackageStatus";

type OrderMapEntry =
  | "rounds"
  | "themes"
  | "questions"
  | "questionFiles"
  | "answerFiles"
  | "answers";

/**
 * Repository for Package entity operations.
 */
@singleton()
export class PackageRepository {
  constructor(
    @inject(DI_TOKENS.Database) private readonly db: Database,
    @inject(DI_TOKENS.TypeORMPackageRepository)
    private readonly repository: Repository<Package>,
    private readonly packageTagRepository: PackageTagRepository
  ) {
    //
  }

  public async get(id: number, select: (keyof Package)[], relations: string[]) {
    return this.repository.findOne({
      where: { id },
      select,
      relations
    });
  }

  public async setStatus(id: number, status: PackageStatus): Promise<Package> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ["author", "logo", "tags"]
    });
    if (!entity) throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, 404);
    entity.status = status;
    return this.repository.save(entity);
  }

  public async search(searchOpts: PackageSearchOpts): Promise<PaginatedResult<Package[]>> {
    const { minRounds, maxRounds, minQuestions, maxQuestions } = searchOpts;
    const searchHelper = new PackageSearchQueryHelper(this.repository);

    const needsStatsFiltering =
      ValueUtils.isNumber(minRounds) ||
      ValueUtils.isNumber(maxRounds) ||
      ValueUtils.isNumber(minQuestions) ||
      ValueUtils.isNumber(maxQuestions);

    if (needsStatsFiltering) {
      return searchHelper.searchWithStatsFiltering(searchOpts);
    }

    return searchHelper.searchWithoutStatsFiltering(searchOpts);
  }

  public findByIds(ids: number[], selectOptions: SelectOptions<Package>): Promise<Package[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: selectOptions.relations
    });
  }

  public async getCountsForPackage(
    packageId: number
  ): Promise<{ roundsCount: number; questionsCount: number }> {
    const result = await this.repository
      .createQueryBuilder("package")
      .select("COUNT(DISTINCT round.id)", "roundCount")
      .addSelect("COUNT(question.id)", "questionCount")
      .leftJoin("package.rounds", "round")
      .leftJoin("round.themes", "theme")
      .leftJoin("theme.questions", "question")
      .where("package.id = :packageId", { packageId })
      .getRawOne();

    if (!result) {
      return {
        roundsCount: 0,
        questionsCount: 0
      };
    }

    return {
      roundsCount: Number(result.roundCount),
      questionsCount: Number(result.questionCount)
    };
  }

  public async getCountsForPackages(
    packageIds: number[]
  ): Promise<Map<number, { roundsCount: number; questionsCount: number }>> {
    if (packageIds.length === 0) return new Map();
    const rows = await this.repository
      .createQueryBuilder("package")
      .select("package.id", "packageId")
      .addSelect("COUNT(DISTINCT round.id)", "roundCount")
      .addSelect("COUNT(question.id)", "questionCount")
      .leftJoin("package.rounds", "round")
      .leftJoin("round.themes", "theme")
      .leftJoin("theme.questions", "question")
      .where("package.id IN (:...packageIds)", { packageIds })
      .groupBy("package.id")
      .getRawMany<{
        packageId: string;
        roundCount: string;
        questionCount: string;
      }>();
    return new Map(
      rows.map((row) => [
        Number(row.packageId),
        {
          roundsCount: Number(row.roundCount),
          questionsCount: Number(row.questionCount)
        }
      ])
    );
  }

  // TODO: Implement better errors handling
  /**
   * Creates package and all related data (rounds, themes etc.) in one transaction
   * @param packageData Full package data with rounds and other
   * @param author Package author, typically current user
   * @returns Package data and files, which can be used for links generation
   */
  public async create(
    packageData: PackageDTO,
    author: User,
    existingPackage?: Package
  ): Promise<{
    pack: Package;
    files: FileDTO[];
  }> {
    /** Files used for file upload links generating later */
    const files: FileDTO[] = [];

    return this.db.dataSource.transaction(async (transaction) => {
      const filesToSave: File[] = [];
      const fileCache = new Map<string, File>();
      const resolveFile = async (filename: string, deferSave: boolean): Promise<File> => {
        const cached = fileCache.get(filename);
        if (cached) return cached;
        let entity = await transaction.getRepository(File).findOne({ where: { filename } });
        if (!entity) {
          entity = new File();
          entity.import({
            filename,
            source: FileSource.S3,
            created_at: new Date(),
            path: StorageUtils.getFilePath(filename)
          });
          if (deferSave) filesToSave.push(entity);
          else await transaction.save(entity);
          files.push(entity.toDTO());
        }
        fileCache.set(filename, entity);
        return entity;
      };
      if (existingPackage) {
        await transaction
          .createQueryBuilder()
          .delete()
          .from(PackageRound)
          .where("package = :packageId", { packageId: existingPackage.id })
          .execute();
        await transaction
          .createQueryBuilder()
          .delete()
          .from(FileUsage)
          .where("package_id = :packageId", { packageId: existingPackage.id })
          .execute();
        await transaction.query(`DELETE FROM "packages_tags" WHERE "package" = $1`, [
          existingPackage.id
        ]);
      }
      // Process Tags, fetch old and save new tags
      const tagNames = (packageData.tags || []).map((tagData) => tagData.tag);

      const existingTags: PackageTag[] = await this.packageTagRepository.getTagsByNames(tagNames);

      const existingTagMap = new Map<string, PackageTag>(existingTags.map((tag) => [tag.tag, tag]));

      const newTags: PackageTag[] = [];
      const tagEntities: PackageTag[] = [];
      for (const tagName of tagNames) {
        let tag = existingTagMap.get(tagName);
        if (!tag) {
          tag = new PackageTag();
          tag.import({ tag: tagName });
          newTags.push(tag);
        }
        tagEntities.push(tag);
      }

      if (newTags.length > 0) {
        await transaction.save(newTags);
      }

      // Save logo info to DB before creating package
      let logoFile: File | null = null;
      if (packageData.logo?.file.md5) {
        logoFile = await resolveFile(packageData.logo.file.md5, false);
      }

      // Create, import and save package
      const pack = existingPackage ?? new Package();

      pack.import({
        ageRestriction: packageData.ageRestriction,
        createdAt: existingPackage?.created_at ?? new Date(),
        author: author,
        title: packageData.title,
        description: packageData.description,
        language: packageData.language,
        status: packageData.status,
        logo: logoFile,
        // Saved automatically because of cascade
        tags: tagEntities
      });
      await transaction.save(pack);

      // Create file usage for logo if it exists (for both new and existing files)
      if (logoFile) {
        const logoUsage = new FileUsage();
        logoUsage.import({
          file: logoFile,
          user: undefined,
          package: pack
        });
        await transaction.save(logoUsage);
      }

      // Arrays for bulk upload
      const roundsToSave: PackageRound[] = [];
      const themesToSave: PackageTheme[] = [];
      const questionsToSave: PackageQuestion[] = [];
      const questionFilesToSave: PackageQuestionFile[] = [];
      const answerFilesToSave: PackageAnswerFile[] = [];
      const fileUsagesToSave: FileUsage[] = [];
      const answersToSave: PackageQuestionChoiceAnswer[] = [];

      // Orders map for checking duplicates
      const ordersMap = new Map<OrderMapEntry, Set<number>>([
        ["rounds", new Set()],
        ["themes", new Set()],
        ["questions", new Set()],
        ["questionFiles", new Set()],
        ["answerFiles", new Set()],
        ["answers", new Set()]
      ]);

      // Create Rounds, Themes, Questions, and Associated Entities
      for (const roundData of packageData.rounds) {
        const round = new PackageRound();
        const orders = ordersMap.get("rounds");

        if (!orders) {
          throw new ServerError("Orders map for rounds not found");
        }

        if (orders.has(roundData.order)) {
          throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
            name: "rounds",
            order: roundData.order
          });
        }

        // Import and save round
        round.import({
          description: roundData.description,
          name: roundData.name,
          package: pack,
          order: roundData.order,
          type: roundData.type
        });
        roundsToSave.push(round);
        orders.add(roundData.order);

        for (const themeData of roundData.themes) {
          const theme = new PackageTheme();
          const orders = ordersMap.get("themes");

          if (!orders) {
            throw new ClientError("Orders map for themes not found");
          }

          if (orders.has(themeData.order)) {
            throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
              name: "themes",
              order: themeData.order
            });
          }

          // Import and save theme
          theme.import({
            description: themeData.description,
            name: themeData.name,
            round,
            order: themeData.order
          });
          themesToSave.push(theme);
          orders.add(themeData.order);

          for (const questionData of themeData.questions) {
            const question = new PackageQuestion();
            const orders = ordersMap.get("questions");

            if (!orders) {
              throw new ClientError("Orders map for questions not found");
            }

            if (orders.has(questionData.order)) {
              throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
                name: "questions",
                order: questionData.order
              });
            }

            // Import and save question data
            question.import({
              theme: theme,
              order: questionData.order,
              price: questionData.price,
              type: questionData.type,
              isHidden: questionData.isHidden,
              text: questionData.text,
              answerHint: questionData.answerHint,
              answerText: questionData.answerText,
              answerDelay: questionData.answerDelay,
              questionComment: questionData.questionComment,
              subType: questionData.subType,
              maxPrice: questionData.maxPrice,
              allowedPrices: questionData.allowedPrices,
              transferType: questionData.transferType,
              priceMultiplier: questionData.priceMultiplier,
              showDelay: questionData.showDelay,
              showAnswerDuration: questionData.showAnswerDuration
            });
            questionsToSave.push(question);
            orders.add(questionData.order);

            // Create and save question files
            for (const questionFileData of questionData.questionFiles || []) {
              const orders = ordersMap.get("questionFiles");

              if (!orders) {
                throw new ClientError("Orders map for question files not found");
              }

              if (orders.has(questionFileData.order)) {
                throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
                  name: "question files",
                  order: questionFileData.order
                });
              }

              const fileEntity = await resolveFile(questionFileData.file.md5, true);

              const questionFile = new PackageQuestionFile();
              questionFile.import({
                file: fileEntity,
                order: questionFileData.order,
                type: questionFileData.file.type,
                display_time: questionFileData.displayTime,
                question: question
              });
              orders.add(questionFileData.order);

              questionFilesToSave.push(questionFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack
              });
              fileUsagesToSave.push(fileUsage);
            }
            ordersMap.set("questionFiles", new Set());

            // Create and save answer files with the saved question
            for (const answerFileData of questionData.answerFiles || []) {
              const orders = ordersMap.get("answerFiles");

              if (!orders) {
                throw new ClientError("Orders map for answer files not found");
              }

              if (orders.has(answerFileData.order)) {
                throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
                  name: "answer files",
                  order: answerFileData.order
                });
              }

              const fileEntity = await resolveFile(answerFileData.file.md5, true);

              const answerFile = new PackageAnswerFile();
              answerFile.import({
                file: fileEntity,
                order: answerFileData.order,
                type: answerFileData.file.type,
                display_time: answerFileData.displayTime,
                question: question
              });
              orders.add(answerFileData.order);

              answerFilesToSave.push(answerFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack
              });
              fileUsagesToSave.push(fileUsage);
            }
            ordersMap.set("answerFiles", new Set());

            // Create and save answers for choice questions (if there any)
            for (const answerData of questionData.answers || []) {
              const orders = ordersMap.get("answers");

              if (!orders) {
                throw new ClientError("Orders map for answers not found");
              }

              if (orders.has(answerData.order)) {
                throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
                  name: "answers",
                  order: answerData.order
                });
              }

              const answer = new PackageQuestionChoiceAnswer();
              let file = null;
              if (answerData.file) {
                const fileEntity = await resolveFile(answerData.file.md5, true);
                file = fileEntity;

                const fileUsage = new FileUsage();
                fileUsage.import({
                  file,
                  user: undefined,
                  package: pack
                });
                fileUsagesToSave.push(fileUsage);
              }

              const type = answerData.file?.type;
              answer.import({
                question: question,
                order: answerData.order,
                text: answerData.text,
                fileData: file && type ? { file, type } : null
              });
              orders.add(answerData.order);

              answersToSave.push(answer);
            }
            ordersMap.set("answers", new Set());
          }
          ordersMap.set("questions", new Set());
        }
        ordersMap.set("themes", new Set());
      }

      // Bulk Save in Order of Dependency
      await transaction.save([
        ...roundsToSave,
        ...themesToSave,
        ...questionsToSave,
        ...filesToSave,
        ...questionFilesToSave,
        ...answerFilesToSave,
        ...fileUsagesToSave,
        ...answersToSave
      ]);

      return { pack, files };
    });
  }

  public async replace(
    existingPackage: Package,
    packageData: PackageDTO,
    author: User
  ): Promise<{ pack: Package; files: FileDTO[] }> {
    return this.create(packageData, author, existingPackage);
  }

  public async deletePackageData(packageId: number): Promise<{ filesDeletedFromDB: string[] }> {
    return this.db.dataSource.transaction(async (transaction) => {
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
          "tags"
        ]
      });

      if (!packageEntity) {
        throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, 404);
      }

      const allFiles = this.collectPackageFiles(packageEntity);
      const fileUsageByFilename = await this.getFileUsageByFilename(
        transaction,
        allFiles.map((file) => file.filename)
      );
      const tagUsageCountsById = await this.getTagUsageCountsById(
        transaction,
        packageEntity.tags?.map((tag) => tag.id) ?? []
      );
      const filesToDelete = this.resolveFilesToDelete(packageId, allFiles, fileUsageByFilename);
      const tagsToDelete = this.resolveTagsToDelete(packageEntity, tagUsageCountsById);
      const fileIdsToDeleteUsage = this.resolveFileUsageIdsToDelete(
        packageEntity.id,
        filesToDelete,
        fileUsageByFilename
      );

      if (fileIdsToDeleteUsage.length > 0) {
        await transaction
          .createQueryBuilder()
          .delete()
          .from("file_usage")
          .where("file_id IN (:...fileIds) AND package_id = :packageId", {
            fileIds: fileIdsToDeleteUsage,
            packageId: packageEntity.id
          })
          .execute();
      }

      if (tagsToDelete.length > 0) {
        await transaction.delete(
          PackageTag,
          tagsToDelete.map((tag) => tag.id)
        );
      }

      await transaction.delete(Package, packageEntity.id);

      const filesDeletedFromDB: string[] = [];
      for (const filename of filesToDelete) {
        const originalUsageRecords = fileUsageByFilename.get(filename) || [];
        const nonPackageUsageRecords = originalUsageRecords.filter(
          (record) => !record.package || record.package.id !== packageEntity.id
        );

        if (nonPackageUsageRecords.length === 0) {
          await transaction
            .createQueryBuilder()
            .delete()
            .from("file")
            .where("filename = :filename", { filename })
            .execute();

          filesDeletedFromDB.push(filename);
        }
      }

      return { filesDeletedFromDB };
    });
  }

  private collectPackageFiles(packageEntity: Package): { filename: string; id: number }[] {
    const allFiles: { filename: string; id: number }[] = [];

    if (packageEntity.logo) {
      allFiles.push({
        filename: packageEntity.logo.filename,
        id: packageEntity.logo.id
      });
    }

    packageEntity.rounds?.forEach((round) => {
      round.themes?.forEach((theme) => {
        theme.questions?.forEach((question) => {
          question.questionFiles?.forEach((questionFile) => {
            if (questionFile.file) {
              allFiles.push({
                filename: questionFile.file.filename,
                id: questionFile.file.id
              });
            }
          });

          question.answerFiles?.forEach((answerFile) => {
            if (answerFile.file) {
              allFiles.push({
                filename: answerFile.file.filename,
                id: answerFile.file.id
              });
            }
          });

          question.answers?.forEach((answer) => {
            if (answer.file) {
              allFiles.push({
                filename: answer.file.filename,
                id: answer.file.id
              });
            }
          });
        });
      });
    });

    return allFiles;
  }

  private async getFileUsageByFilename(
    transaction: EntityManager,
    filenames: string[]
  ): Promise<Map<string, FileUsage[]>> {
    const usageMap = new Map<string, FileUsage[]>();

    for (const filename of filenames) {
      usageMap.set(filename, []);
    }

    if (filenames.length === 0) {
      return usageMap;
    }

    const usageRecords = await transaction.find(FileUsage, {
      where: {
        file: {
          filename: In(filenames)
        }
      },
      relations: ["file", "user", "user.avatar", "package", "package.author"]
    });

    for (const usage of usageRecords) {
      if (usage.file?.filename) {
        const existingUsage = usageMap.get(usage.file.filename) || [];
        existingUsage.push(usage);
        usageMap.set(usage.file.filename, existingUsage);
      }
    }

    return usageMap;
  }

  private async getTagUsageCountsById(
    transaction: EntityManager,
    tagIds: number[]
  ): Promise<Map<number, number>> {
    const usageMap = new Map<number, number>();

    for (const tagId of tagIds) {
      usageMap.set(tagId, 0);
    }

    if (tagIds.length === 0) {
      return usageMap;
    }

    const results = await transaction
      .getRepository(PackageTag)
      .createQueryBuilder("tag")
      .select("tag.id", "tagId")
      .addSelect("COUNT(package.id)", "usageCount")
      .leftJoin("tag.packages", "package")
      .where("tag.id IN (:...tagIds)", { tagIds })
      .groupBy("tag.id")
      .getRawMany<{ tagId: string; usageCount: string }>();

    for (const result of results) {
      usageMap.set(parseInt(result.tagId, 10), parseInt(result.usageCount, 10));
    }

    return usageMap;
  }

  private resolveFilesToDelete(
    packageId: number,
    allFiles: { filename: string; id: number }[],
    fileUsageByFilename: Map<string, FileUsage[]>
  ): string[] {
    const filesToDelete: string[] = [];

    for (const file of allFiles) {
      const usageRecords = fileUsageByFilename.get(file.filename) || [];
      const usedByOtherPackages = usageRecords.some(
        (usage) => usage.package && usage.package.id !== packageId
      );
      const usedByUsers = usageRecords.some((usage) => usage.user);

      if (!usedByOtherPackages && !usedByUsers) {
        filesToDelete.push(file.filename);
      }
    }

    return filesToDelete;
  }

  private resolveTagsToDelete(
    packageEntity: Package,
    tagUsageCountsById: Map<number, number>
  ): PackageTag[] {
    const tagsToDelete: PackageTag[] = [];

    for (const tag of packageEntity.tags ?? []) {
      const tagUsageCount = tagUsageCountsById.get(tag.id) || 0;
      if (tagUsageCount <= 1) {
        tagsToDelete.push(tag);
      }
    }

    return tagsToDelete;
  }

  private resolveFileUsageIdsToDelete(
    packageId: number,
    filesToDelete: string[],
    fileUsageByFilename: Map<string, FileUsage[]>
  ): number[] {
    const fileIdsToDeleteUsage: number[] = [];

    for (const filename of filesToDelete) {
      const usageRecords = fileUsageByFilename.get(filename) || [];
      const packageUsage = usageRecords.find((record) => record.package?.id === packageId);
      if (packageUsage?.file) {
        fileIdsToDeleteUsage.push(packageUsage.file.id);
      }
    }

    return fileIdsToDeleteUsage;
  }
}
