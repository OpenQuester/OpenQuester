import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsGuestAndNameField_1755120048973
  implements MigrationInterface
{
  name = "AddIsGuestAndNameField_1755120048973";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "is_guest" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "name" varchar`);

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.19.0 - Added is_guest and name fields to user table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_guest"`);
  }
}
