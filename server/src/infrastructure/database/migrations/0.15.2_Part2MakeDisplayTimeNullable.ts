import { MigrationInterface, QueryRunner } from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class MakeAnswerAndQuestionDisplayTimeNullable_1747925123456
  implements MigrationInterface
{
  name = "MakeAnswerAndQuestionDisplayTimeNullable_1747925123456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make display_time column nullable for package question files
    await queryRunner.query(
      `ALTER TABLE "package_question_file" ALTER COLUMN "display_time" DROP NOT NULL`
    );

    await queryRunner.query(
      `ALTER TABLE "package_answer_file" ALTER COLUMN "display_time" DROP NOT NULL`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.15.2-2");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // First set all null display_times to 0 before making the column NOT NULL again
    await queryRunner.query(
      `UPDATE "package_question_file" SET "display_time" = 0 WHERE "display_time" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "package_question_file" ALTER COLUMN "display_time" SET NOT NULL`
    );

    await queryRunner.query(
      `UPDATE "package_answer_file" SET "display_time" = 0 WHERE "display_time" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "package_answer_file" ALTER COLUMN "display_time" SET NOT NULL`
    );
  }
}
