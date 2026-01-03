import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class WriteMoreInfoToDB_0_2_9_1725692779638
  implements MigrationInterface
{
  name = "WriteMoreInfoToDB_0_2_9_1725692779638";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "package",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "authorId",
            type: "int",
            isNullable: false,
          },
          {
            name: "title",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "content",
            type: "json",
            isNullable: false,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      })
    );

    // Drop file "type" column if exists
    const table = await queryRunner.getTable("file");
    if (table?.findColumnByName("type")) {
      await queryRunner.dropColumn("file", "type");
    }

    if (!table?.findColumnByName("created_at")) {
      await queryRunner.addColumn(
        "file",
        new TableColumn({
          name: "created_at",
          type: "timestamp",
          default: "CURRENT_TIMESTAMP",
        })
      );
    }

    await queryRunner.createForeignKey(
      "package",
      new TableForeignKey({
        columnNames: ["authorId"],
        referencedTableName: "user",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.2.9", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("package");
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("authorId") !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey("package", foreignKey);
    }
    await queryRunner.dropTable("package");
  }
}
