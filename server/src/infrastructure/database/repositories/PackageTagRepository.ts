import { inject, singleton } from "tsyringe";
import { In, Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";

/**
 * Repository for PackageTag entity operations.
 */
@singleton()
export class PackageTagRepository {
  constructor(
    @inject(DI_TOKENS.TypeORMPackageTagRepository)
    private readonly repository: Repository<PackageTag>
  ) {
    //
  }

  public async getTagsByNames(tags: string[]): Promise<PackageTag[]> {
    if (tags.length < 1) {
      return [];
    }
    return this.repository.find({
      where: { tag: In(tags) }
    });
  }

}
