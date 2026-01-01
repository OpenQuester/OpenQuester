import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { PlayerGameStatsData } from "domain/types/statistics/PlayerGameStatsData";
import { PlayerGameStatsRedisUpdate } from "domain/types/statistics/PlayerGameStatsRedisData";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { LOG_PREFIX } from "infrastructure/logger/LogPrefix";

/**
 * Service for managing player game statistics
 */
export class PlayerGameStatsService {
  constructor(
    private readonly repository: PlayerGameStatsRepository,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Initialize player session in Redis when they join a game
   * This tracks live session data like join time and basic info
   */
  public async initializePlayerSession(
    gameId: string,
    userId: number,
    joinedAt: Date
  ): Promise<void> {
    this.logger.debug("Initializing player session", {
      prefix: LOG_PREFIX.PLAYER_STATS,
      gameId,
      userId,
    });

    // Create initial session data in Redis for live tracking
    const sessionData: PlayerGameStatsRedisUpdate = {
      gameId,
      userId: userId.toString(),
      joinedAt: joinedAt.toISOString(),
      leftAt: "",
      currentScore: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
    };

    try {
      await this.repository.initializeStats(gameId, userId, sessionData);
    } catch (error) {
      this.logger.warn("Failed to initialize player statistics session", {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId: gameId,
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * End player live session in Redis when they leave a game
   * This updates the leave time and saves final session stats
   */
  public async endPlayerSession(
    gameId: string,
    userId: number,
    leftAt: Date
  ): Promise<void> {
    this.logger.debug("Ending player session", {
      prefix: LOG_PREFIX.PLAYER_STATS,
      gameId,
      userId,
    });

    try {
      // Update session with leave time and finalize
      await this.repository.updateStats(gameId, userId, {
        leftAt: leftAt.toISOString(),
      });
    } catch (error) {
      this.logger.error("Failed to end player session", {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async clearPlayerLeftAtTime(
    gameId: string,
    userId: number
  ): Promise<void> {
    try {
      // Use empty string instead of null for Redis storage consistency
      await this.repository.updateStats(gameId, userId, { leftAt: "" });
    } catch (error) {
      this.logger.error("Failed to clear player left time", {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update player answer statistics when they answer a question
   * Should be called whenever a player submits an answer
   */
  public async updatePlayerAnswerStats(
    gameId: string,
    userId: number,
    answerType: AnswerResultType,
    newScore: number
  ): Promise<void> {
    try {
      const playerStats = await this.repository.getStats(gameId, userId);
      const questionsAnswered = parseInt(playerStats?.questionsAnswered || "0");
      const correctAnswers = parseInt(playerStats?.correctAnswers || "0");
      const wrongAnswers = parseInt(playerStats?.wrongAnswers || "0");

      // For skip we don't increment correct/wrong answers
      const isCorrect = answerType === AnswerResultType.CORRECT;
      const isWrong = answerType === AnswerResultType.WRONG;

      const updates: PlayerGameStatsRedisUpdate = {
        currentScore: newScore,
        questionsAnswered: questionsAnswered + 1,
        correctAnswers: isCorrect ? correctAnswers + 1 : correctAnswers,
        wrongAnswers: isWrong ? wrongAnswers + 1 : wrongAnswers,
      };

      await this.repository.updateStats(gameId, userId, updates);
    } catch (error) {
      this.logger.error("Failed to update player answer statistics", {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Collect and save player statistics for a finished game from Redis data
   */
  public async collectGamePlayerStats(
    gameId: string,
    gameStatsId: number
  ): Promise<void> {
    // Get all player stats from Redis before cleanup
    const livePlayerStats = await this.repository.getAllStatsForGame(gameId);

    if (livePlayerStats.length === 0) {
      this.logger.warn("No player statistics found in Redis", {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId,
      });
      return;
    }

    const playerStatsData: PlayerGameStatsData[] = [];

    for (const { userId, data } of livePlayerStats) {
      // Parse Redis data fields
      const finalScore = parseInt(data.currentScore || "0");
      const joinedAt = data.joinedAt ? new Date(data.joinedAt) : new Date();
      const leftAt =
        data.leftAt && data.leftAt !== "" ? new Date(data.leftAt) : null;
      const questionsAnswered = parseInt(data.questionsAnswered || "0");
      const correctAnswers = parseInt(data.correctAnswers || "0");
      const wrongAnswers = parseInt(data.wrongAnswers || "0");

      // Filter out showman-only users who never became players
      const wasEverAPlayer = leftAt === null || questionsAnswered > 0;

      if (!wasEverAPlayer) {
        continue;
      }

      const playerData: PlayerGameStatsData = {
        gameStatsId,
        userId,
        finalScore,
        placement: null, // Will be calculated after all players are saved
        joinedAt,
        leftAt,
        questionsAnswered,
        correctAnswers,
        wrongAnswers,
      };

      playerStatsData.push(playerData);
    }

    // Save all player statistics with calculated placements
    await this.repository.saveMany(this._calculatePlacements(playerStatsData));

    this.logger.info(
      "Player game statistics collected successfully from Redis",
      {
        prefix: LOG_PREFIX.PLAYER_STATS,
        gameId,
        playersCount: playerStatsData.length,
      }
    );
  }

  /**
   * Calculate placements for players based on final scores
   * Handles ties correctly - players with same score get same placement
   */
  private _calculatePlacements(
    playerStats: PlayerGameStatsData[]
  ): PlayerGameStatsData[] {
    // Sort players by final score (descending - highest score first)
    const sorted = [...playerStats].sort((a, b) => b.finalScore - a.finalScore);

    let currentPlacement = 1;
    let lastScore: number | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const player = sorted[i];

      // If score is different from previous player, update placement to current index + 1
      if (lastScore !== null && player.finalScore !== lastScore) {
        currentPlacement = i + 1;
      }

      player.placement = currentPlacement;
      lastScore = player.finalScore;
    }

    return sorted;
  }

  /**
   * Get player statistics for a specific game
   */
  public async getGamePlayerStats(gameStatsId: number) {
    return this.repository.getByGameStatsId(gameStatsId);
  }

  /**
   * Get player statistics history for a user
   */
  public async getUserPlayerStats(userId: number, limit = 50) {
    return this.repository.getByUserId(userId, limit);
  }
}
