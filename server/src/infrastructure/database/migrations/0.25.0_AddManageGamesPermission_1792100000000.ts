import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

/**
 * Adds manage_games (admin panel game moderation) and grants it to every
 * existing admin, i.e. every user who can manage permissions.
 */
export class AddManageGamesPermission_0_25_0_1792100000000 implements MigrationInterface {
  name = "AddManageGamesPermission_0_25_0_1792100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "permission" (name) VALUES ('manage_games');`);

    await queryRunner.query(
      `INSERT INTO "user_permissions" ("user_id", "permission_id")
       SELECT up."user_id", mg."id"
       FROM "user_permissions" up
       JOIN "permission" mp ON mp."id" = up."permission_id" AND mp."name" = 'manage_permissions'
       CROSS JOIN (SELECT "id" FROM "permission" WHERE "name" = 'manage_games') mg
       ON CONFLICT DO NOTHING;`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.25.0 - Added manage_games permission", {
      prefix: LogPrefix.MIGRATION
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "permission" WHERE name = 'manage_games';`);
  }
}
