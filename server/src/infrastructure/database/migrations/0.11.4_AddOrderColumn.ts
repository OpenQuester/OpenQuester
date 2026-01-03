import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddOrderColumn_1745439282807 implements MigrationInterface {
  name = "AddOrderColumn_1745439282807";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = await this._getTables(queryRunner);

    for (const table of tables) {
      if (table && !table.columns.some((col) => col.name === "order")) {
        // Add the "order" column to the all tables
        await queryRunner.addColumn(
          table,
          new TableColumn({
            name: "order",
            type: "smallint",
            default: 0,
            isNullable: false,
          })
        );
      }
    }

    // Step 2: Populate the "order" column with values
    const tableConfigs = [
      { name: "package_round", groupBy: "package" },
      { name: "package_theme", groupBy: "round" },
      { name: "package_question", groupBy: "theme" },
      { name: "package_answer_file", groupBy: "question" },
      { name: "package_question_file", groupBy: "question" },
      { name: "package_question_choice_answer", groupBy: "question" },
    ];

    for (const tableConfig of tableConfigs) {
      const tableName = tableConfig.name;
      const groupBy = tableConfig.groupBy;

      // Fetch all unique group IDs
      const groups = await queryRunner.query(
        `SELECT DISTINCT "${groupBy}" FROM "${tableName}"`
      );

      for (const group of groups) {
        const groupId = group[groupBy];

        // Get all records in this group, sorted by id
        const records = await queryRunner.query(
          `SELECT id FROM "${tableName}" WHERE "${groupBy}" = $1 ORDER BY id`,
          [groupId]
        );

        // Assign order numbers starting from 0
        let orderValue = 0;
        for (const record of records) {
          await queryRunner.query(
            `UPDATE "${tableName}" SET "order" = $1 WHERE id = $2`,
            [orderValue, record.id]
          );
          orderValue++;
        }
      }
    }

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.11.4", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = await this._getTables(queryRunner);

    for (const table of tables) {
      if (table && table.columns.some((col) => col.name === "order")) {
        await queryRunner.dropColumn(table, "order");
      }
    }
  }

  private async _getTables(queryRunner: QueryRunner) {
    return Promise.all([
      queryRunner.getTable("package_round"),
      queryRunner.getTable("package_theme"),
      queryRunner.getTable("package_question"),
      queryRunner.getTable("package_answer_file"),
      queryRunner.getTable("package_question_file"),
      queryRunner.getTable("package_question_choice_answer"),
    ]);
  }
}
