import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddPlayerGameStatsTable_0_17_0_3_1754379351456
  implements MigrationInterface
{
  name = "AddPlayerGameStatsTable_0_17_0_3_1754379351456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create player_game_stats table for individual player performance tracking
    await queryRunner.createTable(
      new Table({
        name: "player_game_stats",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "user_id",
            type: "int",
            isNullable: false,
          },
          {
            name: "game_stats_id",
            type: "int",
            isNullable: false,
          },
          {
            name: "final_score",
            type: "int",
            isNullable: false,
            default: 0,
          },
          {
            name: "placement",
            type: "int",
            isNullable: true,
          },
          {
            name: "joined_at",
            type: "timestamp",
            isNullable: false,
          },
          {
            name: "left_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "questions_answered",
            type: "int",
            isNullable: false,
            default: 0,
          },
          {
            name: "correct_answers",
            type: "int",
            isNullable: false,
            default: 0,
          },
          {
            name: "wrong_answers",
            type: "int",
            isNullable: false,
            default: 0,
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

    // Add foreign key constraint to game_statistics
    await queryRunner.createForeignKey(
      "player_game_stats",
      new TableForeignKey({
        columnNames: ["game_stats_id"],
        referencedTableName: "game_statistics",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // Add foreign key constraint to user table
    await queryRunner.createForeignKey(
      "player_game_stats",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedTableName: "user",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // Add indexes for common query patterns
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_player_game_stats_game_id ON player_game_stats (game_stats_id)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_player_game_stats_user_id ON player_game_stats (user_id)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_player_game_stats_final_score ON player_game_stats (final_score)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_player_game_stats_placement ON player_game_stats (placement)"
    );

    // Unique constraint to prevent duplicate player entries per game
    await queryRunner.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_player_game_stats_unique_player_game ON player_game_stats (game_stats_id, user_id)"
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.17.0-3");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table (this will automatically drop foreign keys and indexes)
    await queryRunner.dropTable("player_game_stats", true);
  }
}
