import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class CreatePermissionTable_0_1_2_1723128633623
  implements MigrationInterface
{
  name = "CreatePermissionTable_0_1_2_1723128633623";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = await PinoLogger.init({ pretty: true });

    await queryRunner.createTable(
      new Table({
        name: "permission",
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
            isNullable: false,
          },
        ],
      })
    );

    await queryRunner.createTable(
      new Table({
        name: "user_permissions",
        columns: [
          {
            name: "user_id",
            type: "int",
            isPrimary: true,
          },
          {
            name: "permission_id",
            type: "int",
            isPrimary: true,
          },
        ],
      })
    );

    await queryRunner.createUniqueConstraint(
      "user_permissions",
      new TableUnique({
        columnNames: ["user_id", "permission_id"],
      })
    );

    await queryRunner.createForeignKey(
      "user_permissions",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedTableName: "user",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "user_permissions",
      new TableForeignKey({
        columnNames: ["permission_id"],
        referencedTableName: "permission",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES ('admin'), ('user');`
    );

    logger.migration("0.1.2");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign keys
    const table = await queryRunner.getTable("user_permissions");
    const foreignKey1 = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("user_id") !== -1
    );
    const foreignKey2 = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("permission_id") !== -1
    );

    if (foreignKey1) {
      await queryRunner.dropForeignKey("user_permissions", foreignKey1);
    }

    if (foreignKey2) {
      await queryRunner.dropForeignKey("user_permissions", foreignKey2);
    }

    // Drop tables
    if (table) {
      await queryRunner.dropTable("user_permissions");
    }

    if (await queryRunner.getTable("permission")) {
      await queryRunner.dropTable("permission");
    }
  }
}
