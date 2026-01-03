import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
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

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.14.2", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_round", "type");
  }
}
