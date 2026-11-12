import { type MigrationInterface, type QueryRunner, TableColumn } from "typeorm";

export class AddQuestionAuthoredContent_0_34_3_1794418572614 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("package_question", [
      new TableColumn({ name: "text_duration_ms", type: "int", isNullable: true }),
      new TableColumn({ name: "text_wait_for_finish", type: "boolean", isNullable: true }),
      new TableColumn({ name: "answer_duration_ms", type: "int", isNullable: true }),
      new TableColumn({ name: "answer_text_items", type: "jsonb", isNullable: true }),
      new TableColumn({ name: "showman_comments", type: "text", isNullable: true }),
      new TableColumn({ name: "answer_explanation", type: "text", isNullable: true })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("package_question", [
      "answer_explanation",
      "showman_comments",
      "answer_text_items",
      "answer_duration_ms",
      "text_wait_for_finish",
      "text_duration_ms"
    ]);
  }
}
