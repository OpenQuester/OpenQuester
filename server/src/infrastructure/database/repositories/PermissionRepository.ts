import { inject, singleton } from "tsyringe";
import { type Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { Permission } from "infrastructure/database/models/Permission";

/**
 * Repository for Permission entity operations.
 */
@singleton()
export class PermissionRepository {
  constructor(
    @inject(DI_TOKENS.TypeORMPermissionRepository)
    private readonly repository: Repository<Permission>
  ) {
    //
  }

  /**
   * Get all permission entities from database.
   */
  public async getAll(): Promise<Permission[]> {
    return this.repository.find();
  }
}
