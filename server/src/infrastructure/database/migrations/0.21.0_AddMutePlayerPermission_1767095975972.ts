import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddMutePlayerPermission_0_21_0_1767095975972
  implements MigrationInterface
{
  name = "AddMutePlayerPermission_0_21_0_1767095975972";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the mute_player permission
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES ('mute_player');`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.21.0 - Added mute_player permission", {
      prefix: LogPrefix.MIGRATION,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the mute_player permission
    // Foreign key CASCADE will automatically remove user_permissions links
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name = 'mute_player';`
    );
  }
}
