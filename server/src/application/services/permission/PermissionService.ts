import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { UserService } from "application/services/user/UserService";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { PermissionRepository } from "infrastructure/database/repositories/PermissionRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service for permission management operations.
 */
@singleton()
export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly userService: UserService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Get all permission entities from database.
   */
  public async getAll(): Promise<Permission[]> {
    return this.permissionRepository.getAll();
  }

  /**
   * Grants all existing permissions to users matched by provided emails.
   * Used during server startup to bootstrap administrator accounts.
   */
  public async grantAllPermissionsByEmails(emails: string[]): Promise<void> {
    if (emails.length === 0) {
      return;
    }

    const allPermissions = await this.getAll();
    if (allPermissions.length === 0) {
      this.logger.warn("No permissions found in database for admin bootstrap", {
        prefix: LogPrefix.USER,
      });
      return;
    }

    const allPermissionIds = new Set(
      allPermissions.map((permission: Permission) => permission.id)
    );

    for (const email of emails) {
      const user = await this.userService.findOne(
        { email, is_deleted: false },
        { select: ["id", "email"], relations: ["permissions"] }
      );

      if (!user) {
        this.logger.warn("Admin bootstrap email not found", {
          prefix: LogPrefix.USER,
          email,
        });
        continue;
      }

      if (this.hasAllPermissions(user, allPermissionIds)) {
        continue;
      }

      user.permissions = allPermissions;
      await this.userService.save(user);

      this.logger.audit("Granted all permissions to admin bootstrap user", {
        prefix: LogPrefix.USER,
        userId: user.id,
        email: user.email,
      });
    }
  }

  private hasAllPermissions(
    user: User,
    allPermissionIds: Set<number>
  ): boolean {
    return (
      user.permissions.length === allPermissionIds.size &&
      user.permissions.every((permission: Permission) =>
        allPermissionIds.has(permission.id)
      )
    );
  }
}
