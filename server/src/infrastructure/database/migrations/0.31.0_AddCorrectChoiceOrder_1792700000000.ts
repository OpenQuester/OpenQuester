import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCorrectChoiceOrder_0_31_0_1792700000000 implements MigrationInterface {
  name = "AddCorrectChoiceOrder_0_31_0_1792700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({
        name: "correct_choice_order",
        type: "int",
        isNullable: true
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "correct_choice_order");
  }
}
