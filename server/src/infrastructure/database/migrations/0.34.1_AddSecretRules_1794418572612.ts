import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSecretRules_0_34_1_1794418572612 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({ name: "secret_rules", type: "jsonb", isNullable: true })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "secret_rules");
  }
}
