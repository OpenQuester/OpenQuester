import { inject, singleton } from "tsyringe";
import { Repository } from "typeorm";

import { DI_TOKENS } from "application/di/tokens";
import {
  GAME_STATISTICS_REDIS_NSP,
  GAME_STATISTICS_TTL,
} from "domain/constants/statistics";
import { GameMode } from "domain/enums/GameMode";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Repository for game statistics (Redis + PostgreSQL).
 */
@singleton()
export class GameStatisticsRepository {
  constructor(
    @inject(DI_TOKENS.TypeORMGameStatisticsRepository)
    private readonly repository: Repository<GameStatistics>,
    private readonly redisService: RedisService
  ) {
    //
  }

  /**
   * Create live game statistics in Redis when game starts
   */
  public async createLiveStatistics(data: GameStatisticsData): Promise<void> {
    const key = this._getRedisKey(data.gameId);
    await this.redisService.hset(key, data, GAME_STATISTICS_TTL);
  }

  /**
   * Get live game statistics from Redis during gameplay
   */
  public async getLiveStatistics(
    gameId: string
  ): Promise<GameStatisticsData | null> {
    const key = this._getRedisKey(gameId);
    const data = await this.redisService.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      gameId: data.gameId,
      startedAt: new Date(data.startedAt),
      finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
      createdBy: parseInt(data.createdBy),
      duration: data.duration ? parseInt(data.duration) : null,
      totalPlayers: data.totalPlayers ? parseInt(data.totalPlayers) : null,
      gameMode: (data.gameMode as GameMode) ?? null,
      totalRounds: data.totalRounds ? parseInt(data.totalRounds) : null,
      totalQuestions: data.totalQuestions
        ? parseInt(data.totalQuestions)
        : null,
    };
  }

  /**
   * Update live game statistics
   */
  public async updateLiveStatistics(
    gameStats: GameStatisticsData,
    updates: Partial<GameStatisticsData>
  ): Promise<void> {
    const updated: GameStatisticsData = {
      ...gameStats,
      ...updates,
    };

    const key = this._getRedisKey(gameStats.gameId);
    await this.redisService.hset(key, updated, GAME_STATISTICS_TTL); // 24 hours TTL
  }

  /**
   * Delete live game statistics from Redis after persistence
   */
  public async deleteLiveStatistics(gameId: string): Promise<void> {
    const key = this._getRedisKey(gameId);
    await this.redisService.del(key);
  }

  /**
   * Create persistent game statistics in database when game finishes
   */
  public async createPersistentStatistics(
    data: GameStatisticsData
  ): Promise<GameStatistics> {
    const gameStats = new GameStatistics();
    gameStats.import(data);

    return this.repository.save(gameStats);
  }

  /**
   * Get persistent game statistics from database by game ID
   */
  public async getPersistentStatistics(
    gameId: string
  ): Promise<GameStatistics | null> {
    return this.repository.findOne({
      where: { game_id: gameId },
    });
  }

  /**
   * Get all persistent game statistics for a user from database
   */
  public async getPersistentStatisticsByUser(
    userId: number
  ): Promise<GameStatistics[]> {
    return this.repository.find({
      where: { created_by: userId },
      order: { created_at: "DESC" },
    });
  }

  /**
   * Update persistent game statistics in database (rare operation)
   */
  public async updatePersistentStatistics(
    gameId: string,
    updates: Partial<GameStatisticsData>
  ): Promise<GameStatistics | null> {
    const existing = await this.getPersistentStatistics(gameId);
    if (!existing) {
      return null;
    }

    // Update the entity with new values
    Object.assign(existing, updates);

    return this.repository.save(existing);
  }

  /**
   * Delete persistent game statistics from database (rare operation)
   */
  public async deletePersistentStatistics(gameId: string): Promise<boolean> {
    const result = await this.repository.delete({ game_id: gameId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Generate Redis key for game statistics
   */
  private _getRedisKey(gameId: string): string {
    return `${GAME_STATISTICS_REDIS_NSP}:${gameId}`;
  }
}
