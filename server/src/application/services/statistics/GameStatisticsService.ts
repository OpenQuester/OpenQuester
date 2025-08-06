import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { GameStatisticsRepository } from "infrastructure/database/repositories/statistics/GameStatisticsRepository";

/**
 * Provides abstraction over live statistics operations in Redis
 * TODO: Currently works only as adapter for repository, but can be extended in future
 */
export class GameStatisticsService {
  constructor(private readonly repository: GameStatisticsRepository) {
    //
  }

  /**
   * Create live game statistics in Redis when game starts
   */
  public async save(data: GameStatisticsData): Promise<void> {
    return this.repository.createLiveStatistics(data);
  }

  /**
   * Get live game statistics from Redis during gameplay
   */
  public async get(gameId: string): Promise<GameStatisticsData | null> {
    return this.repository.getLiveStatistics(gameId);
  }

  /**
   * Delete live game statistics from Redis after persistence
   */
  public async delete(gameId: string): Promise<void> {
    return this.repository.deleteLiveStatistics(gameId);
  }

  /**
   * Update live game statistics in Redis during gameplay
   */
  public async update(
    gameStats: GameStatisticsData,
    updates: Partial<GameStatisticsData>
  ): Promise<void> {
    return this.repository.updateLiveStatistics(gameStats, updates);
  }
}
