import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddQuestionRealPrice_0_34_0_1794418572611 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({ name: "real_price", type: "int", isNullable: true })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "real_price");
  }
}
