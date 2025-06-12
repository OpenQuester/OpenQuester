import { Logger } from "infrastructure/utils/Logger";
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTypeToPackageRound_1747924851733 implements MigrationInterface {
  name = "AddTypeToPackageRound_1747924851733";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_round",
      new TableColumn({
        name: "type",
        type: "enum",
        enum: ["simple", "final"],
        default: "'simple'",
        isNullable: false,
      })
    );

    Logger.logMigrationComplete("0.14.2");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_round", "type");
  }
}
