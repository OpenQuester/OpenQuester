import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class CreateUserAndFileTables_0_1_1_1722683756069
  implements MigrationInterface
{
  name = "CreateUserAndFileTables_0_1_1_1722683756069";

  public async up(queryRunner: QueryRunner): Promise<void> {
    /** Create File table */
    await queryRunner.createTable(
      new Table({
        name: "file",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "path",
            type: "varchar",
          },
          {
            name: "filename",
            type: "varchar",
          },
          {
            name: "type",
            type: "varchar",
          },
        ],
      })
    );

    /** Create User table */
    await queryRunner.createTable(
      new Table({
        name: "user",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "name",
            type: "varchar",
          },
          {
            name: "email",
            type: "varchar",
          },
          {
            name: "password",
            type: "varchar",
          },
          {
            name: "birthday",
            type: "bigint", // timestamp
            isNullable: true,
          },
          {
            name: "avatarId",
            type: "int",
            isNullable: true,
          },
        ],
      })
    );

    // Add a unique constraint on the email column
    await queryRunner.createUniqueConstraint(
      "user",
      new TableUnique({
        columnNames: ["email"],
      })
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      "user",
      new TableForeignKey({
        columnNames: ["avatarId"],
        referencedTableName: "file",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );
    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.1.1", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint first
    const table = await queryRunner.getTable("user");
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("avatarId") !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey("user", foreignKey);
    }

    // Drop the `user` table
    await queryRunner.dropTable("user");

    // Drop the `file` table
    await queryRunner.dropTable("file");
  }
}
