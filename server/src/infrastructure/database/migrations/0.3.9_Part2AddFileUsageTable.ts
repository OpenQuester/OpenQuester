import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddFileUsageTable_1731771003354 implements MigrationInterface {
  name = "AddFileUsageTable_1731771003354";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "file_usage",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "file_id",
            type: "int",
            isNullable: false,
          },
          {
            name: "package_id",
            type: "int",
            isNullable: true,
          },
          {
            name: "user_id",
            type: "int",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Add foreign key for file
    await queryRunner.createForeignKey(
      "file_usage",
      new TableForeignKey({
        columnNames: ["file_id"],
        referencedTableName: "file",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // Add foreign key for package
    await queryRunner.createForeignKey(
      "file_usage",
      new TableForeignKey({
        columnNames: ["package_id"],
        referencedTableName: "package",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );

    // Add foreign key for user
    await queryRunner.createForeignKey(
      "file_usage",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedTableName: "user",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );
    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.3.9-2");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("file_usage", true);
  }
}
