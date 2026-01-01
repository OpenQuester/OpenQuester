import { StatisticsWorkerFactory } from "application/factories/StatisticsWorkerFactory";
import { GameStatisticsService } from "application/services/statistics/GameStatisticsService";
import { Game } from "domain/entities/game/Game";
import { GameMode } from "domain/enums/GameMode";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { ILogger } from "infrastructure/logger/ILogger";
import { LOG_PREFIX } from "infrastructure/logger/LogPrefix";

/**
 * Service responsible for collecting game statistics during gameplay
 * Stores data temporarily in Redis during game progression
 */
export class GameStatisticsCollectorService {
  constructor(
    private readonly statisticsService: GameStatisticsService,
    private readonly statisticsWorkerFactory: StatisticsWorkerFactory,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Start collecting statistics for a game when it begins
   */
  public async startCollection(
    gameId: string,
    startedAt: Date,
    createdBy: number,
    game: Game
  ): Promise<void> {
    const data: GameStatisticsData = {
      gameId,
      startedAt,
      finishedAt: null,
      createdBy,
      duration: null,
      totalPlayers: game.playersCount,
      gameMode: GameMode.DEFAULT,
      totalRounds: game.roundsCount,
      totalQuestions: game.questionsCount,
    };

    await this.statisticsService.save(data);
  }

  /**
   * Finish collecting statistics when game ends.
   * Automatically saves statistics to database and cleans up Redis.
   * This method is idempotent - calling it multiple times is safe.
   */
  public async finishCollection(gameId: string): Promise<void> {
    this.logger.debug(`Collect statistics for game`, {
      prefix: LOG_PREFIX.STATS,
      gameId,
    });

    const gameStats = await this.statisticsService.get(gameId);
    if (!gameStats) {
      this.logger.warn(
        `No statistics found for game ${gameId}, cannot finish collection`,
        {
          prefix: LOG_PREFIX.STATS,
        }
      );
      return;
    }

    // Guard against duplicate finishCollection calls
    if (gameStats.finishedAt) {
      this.logger.debug(
        `Statistics for game ${gameId} already finished, skipping duplicate call`,
        {
          prefix: LOG_PREFIX.STATS,
        }
      );
      return;
    }

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - gameStats.startedAt.getTime();

    await this.statisticsService.update(gameStats, {
      finishedAt,
      duration,
    });

    this.logger.info(`Statistics collection finished for game`, {
      prefix: LOG_PREFIX.STATS,
      gameId,
      duration: `${duration}ms`,
    });

    const updatedStats = {
      ...gameStats,
      finishedAt,
      duration,
    };

    // Save statistics to DB and clean up live statistics from Redis
    await this.statisticsWorkerFactory.executeGameStatisticsPersistence(
      updatedStats
    );
  }
}
