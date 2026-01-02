import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class UpdateUserModelFields_0_1_11_1723107959823
  implements MigrationInterface
{
  name = "UpdateUserModelFields_0_1_11_1723107959823";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = await PinoLogger.init({ pretty: true });

    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "created_at",
        type: "timestamp",
        default: "CURRENT_TIMESTAMP",
      })
    );

    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "updated_at",
        type: "timestamp",
        default: "CURRENT_TIMESTAMP",
      })
    );

    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "is_deleted",
        type: "boolean",
        default: false,
      })
    );

    // Update type of birthday column
    await queryRunner.dropColumn("user", "birthday");
    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "birthday",
        type: "timestamp",
        isNullable: true,
      })
    );
    logger.migration("0.1.11", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("user", "created_at");
    await queryRunner.dropColumn("user", "updated_at");
    await queryRunner.dropColumn("user", "is_deleted");
  }
}
