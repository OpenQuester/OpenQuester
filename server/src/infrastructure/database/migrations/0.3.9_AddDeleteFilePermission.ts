import { MigrationInterface, QueryRunner } from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddDeleteFilePermission_0_3_9_1730832569761
  implements MigrationInterface
{
  name = "AddDeleteFilePermission_0_3_9_1730832569761";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES ('delete_file');`
    );
    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.3.9");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "permission" WHERE name='delete_file'`
    );
  }
}
