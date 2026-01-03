import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddPackageManagementPermissions_0_20_1_1756640611182
  implements MigrationInterface
{
  name = "AddPackageManagementPermissions_0_20_1_1756640611182";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the three new package management permissions
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES 
        ('delete_package'),
        ('edit_package'),
        ('manage_permissions');`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.20.1 - Added package management permissions", {
      prefix: LogPrefix.MIGRATION,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the package management permissions
    // Foreign key CASCADE will automatically remove user_permissions links
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name IN (
        'delete_package',
        'edit_package',
        'manage_permissions'
      );`
    );
  }
}
