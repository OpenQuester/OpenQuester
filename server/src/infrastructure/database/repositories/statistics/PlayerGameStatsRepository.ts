import { inject, singleton } from "tsyringe";
import { Repository } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { PLAYER_STATISTICS_REDIS_NSP, PLAYER_STATISTICS_TTL } from "domain/constants/statistics";
import { ServerError } from "domain/errors/ServerError";
import { PlayerGameStatisticsMapper } from "domain/mappers/PlayerGameStatisticsMapper";
import { PlayerGameStatsData } from "domain/types/statistics/PlayerGameStatsData";
import {
  PlayerGameStatsRedisData,
  PlayerGameStatsRedisUpdate
} from "domain/types/statistics/PlayerGameStatsRedisData";
import { PlayerGameStatsRedisValidator } from "domain/validators/PlayerGameStatsRedisValidator";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";

/**
 * Repository for player game statistics (Redis + PostgreSQL).
 */
@singleton()
export class PlayerGameStatsRepository {
  constructor(
    @inject(DI_TOKENS.TypeORMPlayerGameStatsRepository)
    private readonly repository: Repository<PlayerGameStats>,
    private readonly redisRepository: RedisRepository,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Initialize player session in Redis for live tracking
   */
  public async initializeStats(
    gameId: string,
    userId: number,
    sessionData: Record<string, string>
  ): Promise<void> {
    const key = this._getStatsRedisKey(gameId, userId);
    await this.redisRepository.hset(key, sessionData, PLAYER_STATISTICS_TTL);
  }

  /**
   * Update player session data in Redis
   */
  public async updateStats(
    gameId: string,
    userId: number,
    updates: PlayerGameStatsRedisUpdate
  ): Promise<void> {
    const key = this._getStatsRedisKey(gameId, userId);
    const updateData = PlayerGameStatisticsMapper.buildPlayerStatsUpdateData(updates);

    await this.redisRepository.hset(key, updateData, PLAYER_STATISTICS_TTL);
  }

  /**
   * Get player session data from Redis
   */
  public async getStats(gameId: string, userId: number): Promise<PlayerGameStatsRedisData | null> {
    const key = this._getStatsRedisKey(gameId, userId);
    const data = await this.redisRepository.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    try {
      return PlayerGameStatsRedisValidator.validateRedisData(data);
    } catch (error) {
      throw new ServerError(
        `Failed to validate PlayerGameStats Redis data for game ${gameId}, user ${userId}, data ${JSON.stringify(
          data
        )}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all player stats for a game from Redis
   */
  public async getAllStatsForGame(
    gameId: string
  ): Promise<Array<{ userId: number; data: PlayerGameStatsRedisData }>> {
    const pattern = `${PLAYER_STATISTICS_REDIS_NSP}:${gameId}:*`;
    const keys = await this.redisRepository.scan(pattern);

    const playerStats: Array<{
      userId: number;
      data: PlayerGameStatsRedisData;
    }> = [];

    for (const key of keys) {
      const data = await this.redisRepository.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        // Extract userId from key: "player_stats:gameId:userId"
        const userId = parseInt(key.split(":").pop() || "-1");
        if (userId !== -1) {
          try {
            const validatedData = PlayerGameStatsRedisValidator.validateRedisData(data);

            playerStats.push({ userId, data: validatedData });
          } catch (error) {
            // Log validation error but continue processing other players
            this.logger.error(
              `Skipping invalid Redis data for user: ${
                error instanceof Error ? error.message : String(error)
              }`,
              { prefix: LogPrefix.PLAYER_STATS, data, key, userId }
            );
          }
        }
      }
    }

    return playerStats;
  }

  /**
   * Save multiple player game statistics to database
   */
  public async saveMany(dataList: PlayerGameStatsData[]): Promise<PlayerGameStats[]> {
    const entities = dataList.map((data) => {
      const entity = new PlayerGameStats();
      entity.import(data);
      return entity;
    });

    return this.repository.save(entities);
  }

  /**
   * Get player game statistics by game statistics ID
   */
  public async getByGameStatsId(gameStatsId: number): Promise<PlayerGameStats[]> {
    return this.repository.find({
      where: { game_stats_id: gameStatsId },
      relations: ["user"],
      order: { placement: "ASC" }
    });
  }

  /**
   * Get player game statistics by user ID
   */
  public async getByUserId(userId: number, limit = 50): Promise<PlayerGameStats[]> {
    return this.repository.find({
      where: { user_id: userId },
      relations: ["gameStats"],
      order: { created_at: "DESC" },
      take: limit
    });
  }

  /**
   * Generate Redis key for player session data
   */
  private _getStatsRedisKey(gameId: string, userId: number): string {
    return `${PLAYER_STATISTICS_REDIS_NSP}:${gameId}:${userId}`;
  }
}
