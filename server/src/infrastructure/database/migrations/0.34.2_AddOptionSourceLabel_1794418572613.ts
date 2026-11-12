import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddOptionSourceLabel_0_34_2_1794418572613 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question_choice_answer",
      new TableColumn({
        name: "source_label",
        type: "varchar",
        length: "500",
        isNullable: true
      })
    );
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({
        name: "select_source_right_labels",
        type: "text",
        isArray: true,
        isNullable: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "select_source_right_labels");
    await queryRunner.dropColumn("package_question_choice_answer", "source_label");
  }
}
