import { singleton } from "tsyringe";
import { EntityManager } from "typeorm";

import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { PackageTagRepository } from "infrastructure/database/repositories/PackageTagRepository";

/**
 * Service for package tag operations.
 */
@singleton()
export class PackageTagService {
  constructor(private readonly packageTagRepository: PackageTagRepository) {
    //
  }

  public getTagByName(tag: string) {
    return this.packageTagRepository.getTagByName(tag);
  }

  public async getTagsByNames(tags: string[]): Promise<PackageTag[]> {
    return this.packageTagRepository.getTagsByNames(tags);
  }

  /**
   * Delete tags within a transaction
   */
  public async deleteTagsInTransaction(
    transaction: EntityManager,
    tagsToDelete: PackageTag[]
  ): Promise<void> {
    if (tagsToDelete.length > 0) {
      await transaction.delete(
        PackageTag,
        tagsToDelete.map((t) => t.id)
      );
    }
  }

  /**
   * Get count of packages using a specific tag
   */
  public async getTagUsageCount(tagId: number): Promise<number> {
    return this.packageTagRepository.getTagUsageCount(tagId);
  }

  /**
   * Get usage counts for multiple tags - optimized bulk operation
   */
  public async getBulkTagUsageCounts(
    tagIds: number[]
  ): Promise<Map<number, number>> {
    return this.packageTagRepository.getBulkTagUsageCounts(tagIds);
  }
}
