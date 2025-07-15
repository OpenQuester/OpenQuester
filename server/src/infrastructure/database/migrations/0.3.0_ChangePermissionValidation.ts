import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class ChangePermissionValidation_0_3_0_1729181792142
  implements MigrationInterface
{
  name = "ChangePermissionValidation_0_3_0_1729181792142";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("user_permissions");
    await queryRunner.dropTable("permission");

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

    let query = `INSERT INTO "permission" (name) VALUES `;
    query += `('get_all_users'), ('get_another_user'), `;
    query += `('change_another_user'), ('delete_another_user');`;

    await queryRunner.query(query);

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.3.0");
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

    await queryRunner.dropTable("user_permissions");
    await queryRunner.dropTable("permission");
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
    await queryRunner.query(
      `INSERT INTO "permission" (name) VALUES ('admin'), ('user');`
    );
  }
}
