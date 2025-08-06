import { Repository } from "typeorm";

import {
  PLAYER_STATISTICS_REDIS_NSP,
  PLAYER_STATISTICS_TTL,
} from "domain/constants/statistics";
import { PlayerGameStatsData } from "domain/types/statistics/PlayerGameStatsData";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { RedisService } from "infrastructure/services/redis/RedisService";

/**
 * Repository for player game statistics persistence operations
 */
export class PlayerGameStatsRepository {
  constructor(
    private readonly repository: Repository<PlayerGameStats>,
    private readonly redisService: RedisService
  ) {
    //
  }

  /**
   * Initialize player session in Redis for live tracking
   */
  public async initializeStats(
    gameId: string,
    userId: number,
    sessionData: Record<string, unknown>
  ): Promise<void> {
    const key = this._getStatsRedisKey(gameId, userId);
    await this.redisService.hset(key, sessionData, PLAYER_STATISTICS_TTL);
  }

  /**
   * Update player session data in Redis
   */
  public async updateStats(
    gameId: string,
    userId: number,
    updates: Record<string, any>
  ): Promise<void> {
    const key = this._getStatsRedisKey(gameId, userId);
    await this.redisService.hset(key, updates, PLAYER_STATISTICS_TTL);
  }

  /**
   * Get player session data from Redis
   */
  public async getStats(
    gameId: string,
    userId: number
  ): Promise<Record<string, any> | null> {
    const key = this._getStatsRedisKey(gameId, userId);
    const data = await this.redisService.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return data;
  }

  /**
   * Delete player session from Redis
   */
  public async deleteStats(gameId: string, userId: number): Promise<void> {
    const key = this._getStatsRedisKey(gameId, userId);
    await this.redisService.del(key);
  }

  /**
   * Save player game statistics to database
   */
  public async save(data: PlayerGameStatsData): Promise<PlayerGameStats> {
    const entity = new PlayerGameStats();
    entity.import(data);

    return this.repository.save(entity);
  }

  /**
   * Save multiple player game statistics to database
   */
  public async saveMany(
    dataList: PlayerGameStatsData[]
  ): Promise<PlayerGameStats[]> {
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
  public async getByGameStatsId(
    gameStatsId: number
  ): Promise<PlayerGameStats[]> {
    return this.repository.find({
      where: { game_stats_id: gameStatsId },
      relations: ["user"],
      order: { placement: "ASC" },
    });
  }

  /**
   * Get player game statistics by user ID
   */
  public async getByUserId(
    userId: number,
    limit = 50
  ): Promise<PlayerGameStats[]> {
    return this.repository.find({
      where: { user_id: userId },
      relations: ["gameStats"],
      order: { created_at: "DESC" },
      take: limit,
    });
  }

  /**
   * Get player statistics for a specific game and user
   */
  public async getByGameAndUser(
    gameStatsId: number,
    userId: number
  ): Promise<PlayerGameStats | null> {
    return this.repository.findOne({
      where: {
        game_stats_id: gameStatsId,
        user_id: userId,
      },
      relations: ["user", "gameStats"],
    });
  }

  /**
   * Calculate player rankings/placements for a game
   */
  public async updatePlacements(gameStatsId: number): Promise<void> {
    // Get all players for this game sorted by final score (descending)
    const playerStats = await this.repository.find({
      where: { game_stats_id: gameStatsId },
      order: { final_score: "DESC" },
    });

    // Assign placements based on score ranking
    for (let i = 0; i < playerStats.length; i++) {
      const player = playerStats[i];
      let placement = i + 1;

      // Handle ties - players with same score get same placement
      if (i > 0 && playerStats[i - 1].final_score === player.final_score) {
        placement = playerStats[i - 1].placement!;
      }

      player.placement = placement;
    }

    await this.repository.save(playerStats);
  }

  /**
   * Generate Redis key for player session data
   */
  private _getStatsRedisKey(gameId: string, userId: number): string {
    return `${PLAYER_STATISTICS_REDIS_NSP}:${gameId}:${userId}`;
  }
}
