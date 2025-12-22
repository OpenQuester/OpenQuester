import { Repository, SelectQueryBuilder } from "typeorm";

import { PaginatedResult } from "domain/types/dto";
import { PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { Package } from "infrastructure/database/models/package/Package";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class PackageSearchQueryHelper {
  constructor(private readonly repository: Repository<Package>) {
    //
  }

  public async searchWithStatsFiltering(
    searchOpts: PackageSearchOpts
  ): Promise<PaginatedResult<Package[]>> {
    const {
      order,
      sortBy,
      offset,
      limit,
      title,
      description,
      language,
      authorId,
      tags,
      ageRestriction,
      minRounds,
      maxRounds,
      minQuestions,
      maxQuestions,
    } = searchOpts;

    // Use subquery for stats filtering to maintain proper result set and leverage indexes
    const statsSubquery = this._createStatsSubquery({
      minRounds,
      maxRounds,
      minQuestions,
      maxQuestions,
    });

    // Main query with stats filter as subquery
    const qb = this._createBaseSearchQueryBuilder().where(
      `package.id IN (${statsSubquery.getQuery()})`
    );

    // Set parameters from subquery
    qb.setParameters(statsSubquery.getParameters());

    // Apply other filters
    this._applySearchFilters(qb, {
      title,
      description,
      language,
      authorId,
      tags,
      ageRestriction,
    });

    this._applySortingAndPagination(qb, {
      sortBy,
      order,
      offset,
      limit,
    });

    const [data, total] = await qb.getManyAndCount();
    return { data, pageInfo: { total } };
  }

  public async searchWithoutStatsFiltering(
    searchOpts: PackageSearchOpts
  ): Promise<PaginatedResult<Package[]>> {
    const {
      order,
      sortBy,
      offset,
      limit,
      title,
      description,
      language,
      authorId,
      tags,
      ageRestriction,
    } = searchOpts;

    // Simple search without stats filtering - leverages indexes better
    const qb = this._createBaseSearchQueryBuilder();

    this._applySearchFilters(qb, {
      title,
      description,
      language,
      authorId,
      tags,
      ageRestriction,
    });

    this._applySortingAndPagination(qb, {
      sortBy,
      order,
      offset,
      limit,
    });

    const [data, total] = await qb.getManyAndCount();
    return { data, pageInfo: { total } };
  }

  /**
   * Apply common search filters to query builder.
   */
  private _applySearchFilters(
    qb: SelectQueryBuilder<Package>,
    filters: {
      title?: string;
      description?: string;
      language?: string;
      authorId?: number;
      tags?: string[];
      ageRestriction?: string;
    }
  ): void {
    const { title, description, language, authorId, tags, ageRestriction } =
      filters;

    // Text search using ILIKE - leverages GIN trigram index on title
    if (title && title.length > 0) {
      qb.andWhere("package.title ILIKE :title", { title: `%${title}%` });
    }

    // Description search - no index, but nullable field
    if (description && description.length > 0) {
      qb.andWhere("package.description ILIKE :description", {
        description: `%${description}%`,
      });
    }

    // Exact match filters - use equality for index utilization
    if (language) {
      qb.andWhere("package.language = :language", { language });
    }

    // Author filter - leverages composite index idx_package_author_created_at
    if (authorId) {
      qb.andWhere("package.author = :authorId", { authorId });
    }

    // Age restriction filter - leverages idx_package_age_restriction
    if (ageRestriction) {
      qb.andWhere("package.age_restriction = :ageRestriction", {
        ageRestriction,
      });
    }

    // Tags filter - leverages idx_packages_tags_tag and idx_package_tag_tag
    if (tags && tags.length > 0) {
      qb.andWhere("tag.tag IN (:...tags)", { tags });
    }
  }

  private _createBaseSearchQueryBuilder(): SelectQueryBuilder<Package> {
    return this.repository
      .createQueryBuilder("package")
      .leftJoinAndSelect("package.author", "author")
      .leftJoinAndSelect("package.logo", "logo")
      .leftJoinAndSelect("package.tags", "tag");
  }

  private _createStatsSubquery(filters: {
    minRounds?: number;
    maxRounds?: number;
    minQuestions?: number;
    maxQuestions?: number;
  }): SelectQueryBuilder<Package> {
    const { minRounds, maxRounds, minQuestions, maxQuestions } = filters;

    const statsSubquery = this.repository
      .createQueryBuilder("package")
      .select("package.id")
      .leftJoin("package.rounds", "round")
      .leftJoin("round.themes", "theme")
      .leftJoin("theme.questions", "question")
      .groupBy("package.id");

    let firstHaving = true;

    if (ValueUtils.isNumber(minRounds)) {
      firstHaving = this._applyHavingCondition(
        statsSubquery,
        firstHaving,
        "COUNT(DISTINCT round.id) >= :minRounds",
        { minRounds }
      );
    }

    if (ValueUtils.isNumber(maxRounds)) {
      firstHaving = this._applyHavingCondition(
        statsSubquery,
        firstHaving,
        "COUNT(DISTINCT round.id) <= :maxRounds",
        { maxRounds }
      );
    }

    if (ValueUtils.isNumber(minQuestions)) {
      firstHaving = this._applyHavingCondition(
        statsSubquery,
        firstHaving,
        "COUNT(question.id) >= :minQuestions",
        { minQuestions }
      );
    }

    if (ValueUtils.isNumber(maxQuestions)) {
      this._applyHavingCondition(
        statsSubquery,
        firstHaving,
        "COUNT(question.id) <= :maxQuestions",
        { maxQuestions }
      );
    }

    return statsSubquery;
  }

  private _applySortingAndPagination(
    qb: SelectQueryBuilder<Package>,
    params: {
      sortBy: string;
      order: PaginationOrder;
      offset: number;
      limit: number;
    }
  ): void {
    const { sortBy, order, offset, limit } = params;
    const sortColumn =
      sortBy === "author" ? "author.username" : `package.${sortBy}`;

    qb.orderBy(sortColumn, order.toUpperCase() as "ASC" | "DESC");
    qb.skip(offset).take(limit);
  }

  private _applyHavingCondition(
    qb: SelectQueryBuilder<Package>,
    firstHaving: boolean,
    condition: string,
    parameters: Record<string, unknown>
  ): boolean {
    if (firstHaving) {
      qb.having(condition, parameters);
      return false;
    }

    qb.andHaving(condition, parameters);
    return firstHaving;
  }
}
