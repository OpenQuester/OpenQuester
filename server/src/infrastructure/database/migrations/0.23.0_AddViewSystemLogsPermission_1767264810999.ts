import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddViewSystemLogsPermission_0_23_0_1767264810999
  implements MigrationInterface
{
  name = "AddViewSystemLogsPermission_0_23_0_1767264810999";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the view_system_logs permission
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES ('view_system_logs');`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.23.0 - Added view_system_logs permission", {
      prefix: LogPrefix.MIGRATION,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the view_system_logs permission
    // Foreign key CASCADE will automatically remove user_permissions links
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name = 'view_system_logs';`
    );
  }
}
