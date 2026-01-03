import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class MakeAuthorNullable_1742725198044 implements MigrationInterface {
  name = "MakeAuthorNullable_1742725198044";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "package" ALTER COLUMN "author" DROP NOT NULL;'
    );
    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.9.7-2", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "package" ALTER COLUMN "author" SET NOT NULL;'
    );
  }
}
