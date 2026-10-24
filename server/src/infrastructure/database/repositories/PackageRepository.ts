import { inject, singleton } from "tsyringe";
import { EntityManager, In, IsNull, Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
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
import { FileRepository } from "infrastructure/database/repositories/FileRepository";

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
    private readonly packageTagRepository: PackageTagRepository,
    private readonly fileRepository: FileRepository
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

  /** Only the content generation whose measured quotas passed may become ready. */
  public async markUploadReady(id: number, startedAt: Date | null): Promise<boolean> {
    const result = await this.repository.update(
      {
        id,
        upload_status: PackageUploadStatus.UPLOADING,
        upload_started_at: startedAt ?? IsNull()
      },
      { upload_status: PackageUploadStatus.READY }
    );
    return result.affected === 1;
  }

  /** Ids of packages still uploading that started after `since`, newest first. */
  public async getUploadingSince(since: Date, limit: number): Promise<number[]> {
    const rows = await this.repository
      .createQueryBuilder("package")
      .select("package.id", "id")
      .where("package.upload_status = :status", { status: PackageUploadStatus.UPLOADING })
      .andWhere("package.upload_started_at > :since", { since })
      .orderBy("package.upload_started_at", "DESC")
      .limit(limit)
      .getRawMany<{ id: number }>();

    return rows.map((r) => Number(r.id));
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

  // TODO: Implement better errors handling
  /**
   * Creates package and all related data (rounds, themes etc.) in one transaction
   * @param packageData Full package data with rounds and other
   * @param author Package author, typically current user
   * @returns Package data and files, which can be used for links generation
   */
  /**
   * Creates a package, or with `replaceId` replaces the content of that package
   * in place (same id, author and creation date): its rounds and file usages are
   * removed first, then the new content is written exactly as for a new package.
   */
  public async create(
    packageData: PackageDTO,
    author: User,
    replaceId?: number,
    sourceHash?: string | null
  ): Promise<{
    pack: Package;
    files: FileDTO[];
  }> {
    /** Files used for file upload links generating later */
    const files: FileDTO[] = [];

    return this.db.dataSource.transaction(async (transaction) => {
      let existing: Package | null = null;
      if (replaceId !== undefined) {
        existing = await transaction.findOne(Package, {
          where: { id: replaceId },
          relations: ["author", "tags", "logo"],
          lock: { mode: "pessimistic_write", tables: ["package"] }
        });

        if (!existing) {
          throw new ClientError(ClientResponse.PACKAGE_NOT_FOUND, 404);
        }

        // Themes, questions, their files and choice answers cascade from rounds.
        await transaction.delete(PackageRound, { package: { id: replaceId } });
        await transaction.delete(FileUsage, { package: { id: replaceId } });
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
        logoFile = await this.fileRepository.getFileByFilename(packageData.logo.file.md5);
        if (!logoFile) {
          logoFile = new File();
          logoFile.import({
            filename: packageData.logo.file.md5,
            source: FileSource.S3,
            created_at: new Date(),
            path: StorageUtils.getFilePath(packageData.logo.file.md5)
          });
          await transaction.save(logoFile);
          files.push(logoFile);
        }
      }

      // Create, import and save package
      const pack = existing ?? new Package();

      pack.import({
        ageRestriction: packageData.ageRestriction,
        createdAt: existing?.created_at ?? new Date(),
        author: existing?.author ?? author,
        title: packageData.title,
        description: packageData.description,
        language: packageData.language,
        authors: packageData.authors,
        sources: packageData.sources,
        logo: logoFile,
        // Saved automatically because of cascade
        tags: tagEntities
      });
      // import() keeps an old logo when none is given; an edit may remove it.
      pack.logo = logoFile;
      // Publish readiness only after measured quota validation. The monotonic
      // timestamp also prevents an older refresh from accepting a replacement.
      pack.upload_status = PackageUploadStatus.UPLOADING;
      pack.upload_started_at = new Date(
        Math.max(Date.now(), (existing?.upload_started_at?.getTime() ?? 0) + 1)
      );
      if (sourceHash !== undefined) pack.source_hash = sourceHash;
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
      const filesToSave: File[] = [];
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
              textOrder: questionData.textOrder,
              answerHint: questionData.answerHint,
              answerText: questionData.answerText,
              answerType: questionData.answerType,
              answerNumber: questionData.answerNumber,
              answerPoint: questionData.answerPoint,
              answerDeviation: questionData.answerDeviation,
              rightAnswers: questionData.rightAnswers,
              wrongAnswers: questionData.wrongAnswers,
              authors: questionData.authors,
              sources: questionData.sources,
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

              const fileEntity = new File();
              fileEntity.import({
                filename: questionFileData.file.md5,
                source: FileSource.S3,
                created_at: new Date(),
                path: StorageUtils.getFilePath(questionFileData.file.md5)
              });

              const questionFile = new PackageQuestionFile();
              questionFile.import({
                file: fileEntity,
                order: questionFileData.order,
                type: questionFileData.file.type,
                display_time: questionFileData.displayTime,
                placement: questionFileData.placement,
                wait_for_finish: questionFileData.waitForFinish,
                question: question
              });
              orders.add(questionFileData.order);

              filesToSave.push(fileEntity);
              questionFilesToSave.push(questionFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack
              });
              fileUsagesToSave.push(fileUsage);

              files.push(fileEntity.toDTO());
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

              const fileEntity = new File();
              fileEntity.import({
                filename: answerFileData.file.md5,
                source: FileSource.S3,
                created_at: new Date(),
                path: StorageUtils.getFilePath(answerFileData.file.md5)
              });

              const answerFile = new PackageAnswerFile();
              answerFile.import({
                file: fileEntity,
                order: answerFileData.order,
                type: answerFileData.file.type,
                display_time: answerFileData.displayTime,
                placement: answerFileData.placement,
                wait_for_finish: answerFileData.waitForFinish,
                question: question
              });
              orders.add(answerFileData.order);

              filesToSave.push(fileEntity);
              answerFilesToSave.push(answerFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack
              });
              fileUsagesToSave.push(fileUsage);

              files.push(fileEntity.toDTO());
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
                const fileEntity = new File();
                fileEntity.import({
                  filename: answerData.file.md5,
                  source: FileSource.S3,
                  created_at: new Date(),
                  path: StorageUtils.getFilePath(answerData.file.md5)
                });
                file = fileEntity;
                filesToSave.push(file);

                const fileUsage = new FileUsage();
                fileUsage.import({
                  file,
                  user: undefined,
                  package: pack
                });
                fileUsagesToSave.push(fileUsage);

                files.push(file.toDTO());
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

  /** Delete package references; the shared cleanup service checks files after commit. */
  public async deletePackageData(packageId: number): Promise<{ filenames: string[] }> {
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
      const tagUsageCountsById = await this.getTagUsageCountsById(
        transaction,
        packageEntity.tags?.map((tag) => tag.id) ?? []
      );
      const tagsToDelete = this.resolveTagsToDelete(packageEntity, tagUsageCountsById);
      // The FK uses SET NULL, so remove only this package's ownership rows first.
      await transaction.delete(FileUsage, { package: { id: packageEntity.id } });

      if (tagsToDelete.length > 0) {
        await transaction.delete(
          PackageTag,
          tagsToDelete.map((tag) => tag.id)
        );
      }

      await transaction.delete(Package, packageEntity.id);
      return { filenames: [...new Set(allFiles.map((file) => file.filename))] };
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
}
