import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddQuestionContentFields_0_32_0_1793200000000 implements MigrationInterface {
  name = "AddQuestionContentFields_0_32_0_1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("package_question", [
      new TableColumn({ name: "text_items", type: "jsonb", isNullable: true }),
      new TableColumn({ name: "point_image_order", type: "int", isNullable: true })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("package_question", ["text_items", "point_image_order"]);
  }
}
