import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddUserBannedField_0_18_1_1754817772725
  implements MigrationInterface
{
  name = "AddUserBannedField_0_18_1_1754817772725";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "is_banned",
        type: "boolean",
        default: false,
        isNullable: false,
      })
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.18.1 - Added is_banned column to user table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("user", "is_banned");
  }
}
