import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class UpdateUserAndFileAndAddDiscordId_0_8_2_1738571232826
  implements MigrationInterface
{
  name = "UpdateUserAndFileAndAddDiscordId_0_8_2_1738571232826";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update user
    await queryRunner.renameColumn("user", "name", "username");

    await queryRunner.changeColumn(
      "user",
      "email",
      new TableColumn({
        name: "email",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.changeColumn(
      "user",
      "birthday",
      new TableColumn({
        name: "birthday",
        type: "date",
        isNullable: true,
      })
    );

    // Add discord_id
    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "discord_id",
        type: "varchar",
        isNullable: true,
        isUnique: true,
      })
    );

    // Remove password column
    await queryRunner.dropColumn("user", "password");

    // Update file
    await queryRunner.query(
      `CREATE TYPE "file_source_enum" AS ENUM ('s3', 'discord')`
    );

    await queryRunner.addColumn(
      "file",
      new TableColumn({
        name: "source",
        type: "enum",
        enum: ["s3", "discord"],
        enumName: "file_source_enum",
        default: `'s3'`,
        isNullable: false,
      })
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.8.2", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN "discord_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "user"
      RENAME COLUMN "username" TO "name";
    `);

    await queryRunner.changeColumn(
      "user",
      "email",
      new TableColumn({
        name: "email",
        type: "varchar",
        isNullable: true,
      })
    );

    await queryRunner.changeColumn(
      "user",
      "birthday",
      new TableColumn({
        name: "birthday",
        type: "timestamp",
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      "user",
      new TableColumn({
        name: "password",
        type: "varchar",
        isNullable: true,
        isUnique: false,
      })
    );

    await queryRunner.dropColumn("file", "source");
  }
}
