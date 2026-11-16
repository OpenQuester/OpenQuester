import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionScript_0_34_4_1794418572615 implements MigrationInterface {
  // Store normalized SIQ question steps so the game can replay the authored
  // content, answer flow, and scoring rules in order. A null script keeps
  // existing questions on the standard gameplay path.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "package_question" ADD "script" jsonb');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "package_question" DROP COLUMN "script"');
  }
}
