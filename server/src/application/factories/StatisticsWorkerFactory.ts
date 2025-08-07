import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { GameStatisticsPersistenceWorker } from "application/workers/GameStatisticsPersistenceWorker";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { GameStatisticsRepository } from "infrastructure/database/repositories/statistics/GameStatisticsRepository";
import { ILogger } from "infrastructure/logger/ILogger";

export class StatisticsWorkerFactory {
  constructor(
    private readonly gameStatisticsRepository: GameStatisticsRepository,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  public createGameStatisticsPersistenceWorker(): GameStatisticsPersistenceWorker {
    return new GameStatisticsPersistenceWorker(
      this.gameStatisticsRepository,
      this.playerGameStatsService,
      this.logger
    );
  }

  /**
   * Execute game statistics persistence workflow
   * Convenience method for creating and executing worker in one call
   */
  public async executeGameStatisticsPersistence(
    gameStats: GameStatisticsData
  ): Promise<void> {
    const worker = this.createGameStatisticsPersistenceWorker();
    await worker.execute(gameStats);
  }
}
