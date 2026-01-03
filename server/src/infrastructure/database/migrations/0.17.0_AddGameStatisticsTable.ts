import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddGameStatisticsTable_0_17_0_1754379291456
  implements MigrationInterface
{
  name = "AddGameStatisticsTable_0_17_0_1754379291456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create game_statistics table
    await queryRunner.createTable(
      new Table({
        name: "game_statistics",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "game_id",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "started_at",
            type: "timestamp",
            isNullable: false,
          },
          {
            name: "finished_at",
            type: "timestamp",
            isNullable: false,
          },
          {
            name: "created_by",
            type: "int",
            isNullable: false,
          },
          {
            name: "duration",
            type: "int",
            isNullable: false,
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

    // Add foreign key constraint for created_by -> user.id
    await queryRunner.createForeignKey(
      "game_statistics",
      new TableForeignKey({
        columnNames: ["created_by"],
        referencedTableName: "user",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // Add index for game_id for faster lookups
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_game_statistics_game_id ON game_statistics (game_id)"
    );

    // Add index for created_by for user statistics
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_game_statistics_created_by ON game_statistics (created_by)"
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.17.0", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table (this will automatically drop the foreign key and indexes)
    await queryRunner.dropTable("game_statistics", true);
  }
}
