import { MigrationInterface, QueryRunner } from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddAdminPermissions_0_18_0_1754499351456
  implements MigrationInterface
{
  name = "AddAdminPermissions_0_18_0_1754499351456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the three new admin permissions
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES 
        ('admin_panel_access'),
        ('view_system_health'),
        ('view_users_info'),
        ('ban_users');`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.18.0 - Added admin panel permissions");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the admin permissions
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name IN (
        'admin_panel_access',
        'view_system_health', 
        'view_users_info',
        'ban_users'
      );`
    );
  }
}
