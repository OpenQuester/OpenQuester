import { inject, singleton } from "tsyringe";
import { Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { GAME_STATISTICS_REDIS_NSP, GAME_STATISTICS_TTL } from "domain/constants/statistics";
import { GameMode } from "domain/enums/GameMode";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { GameStatisticsMapper } from "domain/mappers/GameStatisticsMapper";

/**
 * Repository for game statistics (Redis + PostgreSQL).
 */
@singleton()
export class GameStatisticsRepository {
  constructor(
    @inject(DI_TOKENS.TypeORMGameStatisticsRepository)
    private readonly repository: Repository<GameStatistics>,
    private readonly redisRepository: RedisRepository
  ) {
    //
  }

  /**
   * Create live game statistics in Redis when game starts
   */
  public async createLiveStatistics(data: GameStatisticsData): Promise<void> {
    const key = this._getRedisKey(data.gameId);
    await this.redisRepository.hset(
      key,
      GameStatisticsMapper.serializeLiveStatistics(data),
      GAME_STATISTICS_TTL
    );
  }

  /**
   * Get live game statistics from Redis during gameplay
   */
  public async getLiveStatistics(gameId: string): Promise<GameStatisticsData | null> {
    const key = this._getRedisKey(gameId);
    const data = await this.redisRepository.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      gameId: data.gameId,
      startedAt: new Date(parseInt(data.startedAt)),
      finishedAt: data.finishedAt ? new Date(parseInt(data.finishedAt)) : null,
      createdBy: parseInt(data.createdBy),
      duration: data.duration ? parseInt(data.duration) : null,
      totalPlayers: data.totalPlayers ? parseInt(data.totalPlayers) : null,
      gameMode: (data.gameMode as GameMode) ?? null,
      totalRounds: data.totalRounds ? parseInt(data.totalRounds) : null,
      totalQuestions: data.totalQuestions ? parseInt(data.totalQuestions) : null
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
      ...updates
    };

    const key = this._getRedisKey(gameStats.gameId);
    await this.redisRepository.hset(
      key,
      GameStatisticsMapper.serializeLiveStatistics(updated),
      GAME_STATISTICS_TTL
    ); // 24 hours TTL
  }

  /**
   * Delete live game statistics from Redis after persistence
   */
  public async deleteLiveStatistics(gameId: string): Promise<void> {
    const key = this._getRedisKey(gameId);
    await this.redisRepository.del(key);
  }

  /**
   * Create persistent game statistics in database when game finishes
   */
  public async createPersistentStatistics(data: GameStatisticsData): Promise<GameStatistics> {
    const gameStats = new GameStatistics();
    gameStats.import(data);

    return this.repository.save(gameStats);
  }

  /**
   * Generate Redis key for game statistics
   */
  private _getRedisKey(gameId: string): string {
    return `${GAME_STATISTICS_REDIS_NSP}:${gameId}`;
  }
}
