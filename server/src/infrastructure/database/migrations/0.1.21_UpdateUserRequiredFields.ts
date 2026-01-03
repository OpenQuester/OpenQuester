import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class UpdateUserRequiredFields_0_1_21_1723204474011
  implements MigrationInterface
{
  name = "UpdateUserRequiredFields_0_1_21_1723204474011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD CONSTRAINT "UQ_user_name" UNIQUE ("name");
    `);
    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.1.21", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP CONSTRAINT "UQ_user_name";
    `);
  }
}
