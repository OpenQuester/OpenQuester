import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class ExtendGameStatisticsTable_0_17_0_2_1754379301456
  implements MigrationInterface
{
  name = "ExtendGameStatisticsTable_0_17_0_2_1754379301456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for game_mode
    await queryRunner.query(`
      CREATE TYPE game_mode_enum AS ENUM ('default')
    `);

    // Add new columns to game_statistics table for Phase 1 metrics
    await queryRunner.addColumns("game_statistics", [
      new TableColumn({
        name: "total_players",
        type: "int",
        isNullable: true, // Allow null for existing records (same for all other)
      }),
      new TableColumn({
        name: "game_mode",
        type: "game_mode_enum",
        isNullable: true,
        default: "'default'",
      }),
      new TableColumn({
        name: "total_rounds",
        type: "int",
        isNullable: true,
      }),
      new TableColumn({
        name: "total_questions",
        type: "int",
        isNullable: true,
      }),
    ]);

    // Add indexes for common query patterns
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_game_statistics_game_mode ON game_statistics (game_mode)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_game_statistics_total_players ON game_statistics (total_players)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_game_statistics_started_at ON game_statistics (started_at)"
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.17.0-2", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the added indexes
    await queryRunner.query(
      "DROP INDEX IF EXISTS idx_game_statistics_game_mode"
    );
    await queryRunner.query(
      "DROP INDEX IF EXISTS idx_game_statistics_total_players"
    );
    await queryRunner.query(
      "DROP INDEX IF EXISTS idx_game_statistics_started_at"
    );

    // Drop the added columns
    await queryRunner.dropColumns("game_statistics", [
      "total_players",
      "game_mode",
      "total_rounds",
      "total_questions",
    ]);

    // Drop the enum type
    await queryRunner.query("DROP TYPE IF EXISTS game_mode_enum");
  }
}
