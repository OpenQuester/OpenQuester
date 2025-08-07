import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { GameStatisticsRepository } from "infrastructure/database/repositories/statistics/GameStatisticsRepository";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Worker responsible for persisting game statistics from Redis to database
 * Executes in background when game finishes to avoid blocking game flow
 */
export class GameStatisticsPersistenceWorker {
  constructor(
    private readonly repository: GameStatisticsRepository,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Execute the persistence workflow for a completed game
   * This method should be called when GAME_FINISHED event is emitted
   */
  public async execute(gameStats: GameStatisticsData): Promise<void> {
    this.logger.debug(`Saving game stats to DB`, {
      prefix: "[GAME_STATISTICS_WORKER]: ",
      gameId: gameStats.gameId,
    });

    try {
      // Validate that the game is actually finished
      if (!gameStats.finishedAt) {
        this.logger.warn(
          `Game statistics for ${gameStats.gameId} are incomplete (not finished), skipping persistence`,
          {
            prefix: "[GAME_STATISTICS_WORKER]: ",
            hasFinishedAt: !!gameStats.finishedAt,
            hasDuration: !!gameStats.duration,
          }
        );
        return;
      }

      // Create persistent record in database
      const savedStats = await this.repository.createPersistentStatistics(
        gameStats
      );

      this.logger.info(`Game statistics saved to DB`, {
        prefix: "[GAME_STATISTICS_WORKER]: ",
        gameId: gameStats.gameId,
        statisticsId: savedStats.id,
        gameDuration: `${(gameStats.duration ?? 0) / (1000 * 60)} minutes`,
      });

      // Collect and persist player statistics before cleaning up Redis
      this.logger.debug(`Collecting player statistics for persistence`, {
        prefix: "[GAME_STATISTICS_WORKER]: ",
        gameId: gameStats.gameId,
      });

      await this.playerGameStatsService.collectGamePlayerStats(
        gameStats.gameId,
        savedStats.id
      );

      this.logger.info(`Player statistics collected and saved to DB`, {
        prefix: "[GAME_STATISTICS_WORKER]: ",
        gameId: gameStats.gameId,
      });

      // Clean up live statistics from Redis after successful persistence
      await this.repository.deleteLiveStatistics(gameStats.gameId);

      this.logger.debug(`Cleaned up live statistics from Redis`, {
        prefix: "[GAME_STATISTICS_WORKER]: ",
        gameId: gameStats.gameId,
      });
    } catch (error) {
      // Log error but don't rethrow - we don't want to break game flow
      this.logger.error(
        `Failed to persist game statistics for game ${gameStats.gameId}: ${error}`,
        {
          prefix: "[GAME_STATISTICS_WORKER]: ",
        }
      );
    }
  }
}
