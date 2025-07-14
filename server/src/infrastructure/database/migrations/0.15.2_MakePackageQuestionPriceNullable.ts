import { MigrationInterface, QueryRunner } from "typeorm";

import { Logger } from "infrastructure/utils/Logger";

export class MakePackageQuestionPriceNullable_1747925123456
  implements MigrationInterface
{
  name = "MakePackageQuestionPriceNullable_1747925123456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make price column nullable for final round questions where players bid after theme selection
    await queryRunner.query(
      `ALTER TABLE "package_question" ALTER COLUMN "price" DROP NOT NULL`
    );

    Logger.logMigrationComplete("0.15.2");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // First set all null prices to 0 before making the column NOT NULL again
    await queryRunner.query(
      `UPDATE "package_question" SET "price" = 0 WHERE "price" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "package_question" ALTER COLUMN "price" SET NOT NULL`
    );
  }
}
