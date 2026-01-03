import { MigrationInterface, QueryRunner } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddMutedUntilToUser_0_21_0_1767095976000
  implements MigrationInterface
{
  name = "AddMutedUntilToUser_0_21_0_1767095976000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add muted_until column to user table
    await queryRunner.query(
      `ALTER TABLE "user" ADD "muted_until" TIMESTAMP WITH TIME ZONE NULL;`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.21.0 - Added muted_until column to user table", {
      prefix: LogPrefix.MIGRATION,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove muted_until column from user table
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "muted_until";`);
  }
}
