import { In, Repository } from "typeorm";

import { PackageTag } from "infrastructure/database/models/package/PackageTag";

export class PackageTagRepository {
  constructor(private readonly repository: Repository<PackageTag>) {
    //
  }

  public getTagByName(tag: string) {
    return this.repository.findOne({
      where: { tag },
    });
  }

  public async getTagsByNames(tags: string[]): Promise<PackageTag[]> {
    if (tags.length < 1) {
      return [];
    }
    return this.repository.find({
      where: { tag: In(tags) },
    });
  }

  /**
   * Get count of packages using a specific tag
   */
  public async getTagUsageCount(tagId: number): Promise<number> {
    return this.repository
      .createQueryBuilder("tag")
      .innerJoin("tag.packages", "package")
      .where("tag.id = :tagId", { tagId })
      .getCount();
  }

  /**
   * Get usage counts for multiple tags - optimized bulk operation
   */
  public async getBulkTagUsageCounts(
    tagIds: number[]
  ): Promise<Map<number, number>> {
    if (tagIds.length === 0) {
      return new Map();
    }

    const results = await this.repository
      .createQueryBuilder("tag")
      .select("tag.id", "tagId")
      .addSelect("COUNT(package.id)", "usageCount")
      .leftJoin("tag.packages", "package")
      .where("tag.id IN (:...tagIds)", { tagIds })
      .groupBy("tag.id")
      .getRawMany();

    const usageMap = new Map<number, number>();

    // Initialize all requested tag IDs with count 0
    for (const tagId of tagIds) {
      usageMap.set(tagId, 0);
    }

    // Update with actual counts
    for (const result of results) {
      usageMap.set(parseInt(result.tagId), parseInt(result.usageCount));
    }

    return usageMap;
  }
}
