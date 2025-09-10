import { EntityManager, In, Repository } from "typeorm";

import { FileService } from "application/services/file/FileService";
import { PackageTagService } from "application/services/package/PackageTagService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FileSource } from "domain/enums/file/FileSource";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackagePaginationOpts } from "domain/types/pagination/package/PackagePaginationOpts";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
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

type OrderMapEntry =
  | "rounds"
  | "themes"
  | "questions"
  | "questionFiles"
  | "answerFiles"
  | "answers";

export class PackageRepository {
  constructor(
    private readonly db: Database,
    private readonly repository: Repository<Package>,
    private readonly packageTagService: PackageTagService,
    private readonly fileService: FileService
  ) {
    //
  }

  public async get(id: number, select: (keyof Package)[], relations: string[]) {
    return this.repository.findOne({
      where: { id },
      select,
      relations,
    });
  }

  public async list(
    paginationOpts: PackagePaginationOpts
  ): Promise<PaginatedResult<Package[]>> {
    const {
      order = PaginationOrder.ASC,
      sortBy = "created_at",
      offset,
      limit,
      title,
    } = paginationOpts;

    // Shallow fetch only data required by toSimpleDTO (author, logo, tags)
    const qb = this.repository
      .createQueryBuilder("package")
      .leftJoinAndSelect("package.author", "author")
      .leftJoinAndSelect("package.logo", "logo")
      .leftJoinAndSelect("package.tags", "tag")
      .skip(offset)
      .take(limit);

    if (title && title.length > 0) {
      qb.andWhere("package.title ILIKE :title", { title: `%${title}%` });
    }

    const sortColumn =
      sortBy === "author" ? "author.username" : `package.${sortBy}`;
    qb.orderBy(sortColumn, order.toUpperCase() as "ASC" | "DESC");

    const [data, total] = await qb.getManyAndCount();

    return { data, pageInfo: { total } };
  }

  public findByIds(
    ids: number[],
    selectOptions: SelectOptions<Package>
  ): Promise<Package[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: selectOptions.relations,
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
        questionsCount: 0,
      };
    }

    return {
      roundsCount: Number(result.roundCount),
      questionsCount: Number(result.questionCount),
    };
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
    author: User
  ): Promise<{
    pack: Package;
    files: FileDTO[];
  }> {
    /** Files used for file upload links generating later */
    const files: FileDTO[] = [];

    return this.db.dataSource.transaction(async (transaction) => {
      // Process Tags, fetch old and save new tags
      const tagNames = (packageData.tags || []).map((tagData) => tagData.tag);

      const existingTags: PackageTag[] =
        await this.packageTagService.getTagsByNames(tagNames);

      const existingTagMap = new Map<string, PackageTag>(
        existingTags.map((tag) => [tag.tag, tag])
      );

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

      // Save logo info to DB before creating package
      let logoFile = null;
      if (packageData.logo?.file.md5) {
        logoFile = await this.fileService.getFileByFilename(
          packageData.logo.file.md5
        );
        if (!logoFile) {
          logoFile = new File();
          logoFile.import({
            filename: packageData.logo.file.md5,
            source: FileSource.S3,
            created_at: new Date(),
            path: StorageUtils.getFilePath(packageData.logo.file.md5),
          });
          await transaction.save(logoFile);
          files.push(logoFile);
        }
      }

      // Create, import and save package
      const pack = new Package();

      pack.import({
        ageRestriction: packageData.ageRestriction,
        createdAt: new Date(),
        author: author,
        title: packageData.title,
        description: packageData.description,
        language: packageData.language,
        logo: logoFile,
        // Saved automatically because of cascade
        tags: tagEntities,
      });
      await transaction.save(pack);

      // Create file usage for logo if it exists (for both new and existing files)
      if (logoFile) {
        const logoUsage = new FileUsage();
        logoUsage.import({
          file: logoFile,
          user: undefined,
          package: pack,
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
        ["answers", new Set()],
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
            order: roundData.order,
          });
        }

        // Import and save round
        round.import({
          description: roundData.description,
          name: roundData.name,
          package: pack,
          order: roundData.order,
          type: roundData.type,
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
              order: themeData.order,
            });
          }

          // Import and save theme
          theme.import({
            description: themeData.description,
            name: themeData.name,
            round,
            order: themeData.order,
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
                order: questionData.order,
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
            });
            questionsToSave.push(question);
            orders.add(questionData.order);

            // Create and save question files
            for (const questionFileData of questionData.questionFiles || []) {
              const orders = ordersMap.get("questionFiles");

              if (!orders) {
                throw new ClientError(
                  "Orders map for question files not found"
                );
              }

              if (orders.has(questionFileData.order)) {
                throw new ClientError(ClientResponse.ORDER_DUPLICATED, 400, {
                  name: "question files",
                  order: questionFileData.order,
                });
              }

              const fileEntity = new File();
              fileEntity.import({
                filename: questionFileData.file.md5,
                source: FileSource.S3,
                created_at: new Date(),
                path: StorageUtils.getFilePath(questionFileData.file.md5),
              });

              const questionFile = new PackageQuestionFile();
              questionFile.import({
                file: fileEntity,
                order: questionFileData.order,
                type: questionFileData.file.type,
                display_time: questionFileData.displayTime,
                question: question,
              });
              orders.add(questionFileData.order);

              filesToSave.push(fileEntity);
              questionFilesToSave.push(questionFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack,
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
                  order: answerFileData.order,
                });
              }

              const fileEntity = new File();
              fileEntity.import({
                filename: answerFileData.file.md5,
                source: FileSource.S3,
                created_at: new Date(),
                path: StorageUtils.getFilePath(answerFileData.file.md5),
              });

              const answerFile = new PackageAnswerFile();
              answerFile.import({
                file: fileEntity,
                order: answerFileData.order,
                type: answerFileData.file.type,
                display_time: answerFileData.displayTime,
                question: question,
              });
              orders.add(answerFileData.order);

              filesToSave.push(fileEntity);
              answerFilesToSave.push(answerFile);

              const fileUsage = new FileUsage();
              fileUsage.import({
                file: fileEntity,
                user: undefined,
                package: pack,
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
                  order: answerData.order,
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
                  path: StorageUtils.getFilePath(answerData.file.md5),
                });
                file = fileEntity;
                filesToSave.push(file);

                const fileUsage = new FileUsage();
                fileUsage.import({
                  file,
                  user: undefined,
                  package: pack,
                });
                fileUsagesToSave.push(fileUsage);

                files.push(file.toDTO());
              }

              const type = answerData.file?.type;
              answer.import({
                question: question,
                order: answerData.order,
                text: answerData.text,
                fileData: file && type ? { file, type } : null,
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
        ...answersToSave,
      ]);

      return { pack, files };
    });
  }

  /**
   * Execute function within a database transaction
   */
  public async executeInTransaction<T>(
    fn: (transaction: EntityManager) => Promise<T>
  ): Promise<T> {
    return this.db.dataSource.transaction(fn);
  }

  /**
   * Delete package and related data within a transaction
   */
  public async deleteInTransaction(
    transaction: EntityManager,
    packageEntity: Package
  ): Promise<void> {
    // Delete the package (CASCADE will handle related entities)
    await transaction.delete(Package, packageEntity.id);
  }
}
