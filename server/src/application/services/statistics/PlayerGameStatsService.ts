import { Game } from "domain/entities/game/Game";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatsData } from "domain/types/statistics/PlayerGameStatsData";
import { PlayerGameStatsRepository } from "infrastructure/database/repositories/statistics/PlayerGameStatsRepository";
import { ILogger } from "infrastructure/logger/ILogger";

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
      prefix: "[PLAYER_GAME_STATS]: ",
      gameId,
      userId,
    });

    // Create initial session data in Redis for live tracking
    const sessionData = {
      gameId,
      userId,
      joinedAt,
      leftAt: null,
      currentScore: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
    };

    try {
      await this.repository.initializeStats(gameId, userId, sessionData);
    } catch (error) {
      this.logger.warn("Failed to initialize player statistics session", {
        prefix: "[PLAYER_GAME_STATS]: ",
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
      prefix: "[PLAYER_GAME_STATS]: ",
      gameId,
      userId,
    });

    try {
      // Update session with leave time and finalize
      await this.repository.updateStats(gameId, userId, { leftAt });
    } catch (error) {
      this.logger.error("Failed to end player session", {
        prefix: "[PLAYER_GAME_STATS]: ",
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
      await this.repository.updateStats(gameId, userId, { leftAt: null });
    } catch (error) {
      this.logger.error("Failed to clear player left time", {
        prefix: "[PLAYER_GAME_STATS]: ",
        gameId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Collect and save player statistics for a finished game
   */
  public async collectGamePlayerStats(
    gameStatsId: number,
    game: Game,
    gameStartedAt: Date
  ): Promise<void> {
    this.logger.debug("Collecting player game statistics", {
      prefix: "[PLAYER_GAME_STATS]: ",
      gameId: game.id,
      gameStatsId,
    });

    const players = game.players.filter((p) => p.role === PlayerRole.PLAYER);
    const playerStatsData: PlayerGameStatsData[] = [];

    for (const player of players) {
      // Calculate basic performance metrics
      const correctAnswers = this._calculateCorrectAnswers(
        game,
        player.meta.id
      );
      const wrongAnswers = this._calculateWrongAnswers(game, player.meta.id);
      const questionsAnswered = correctAnswers + wrongAnswers;

      const playerData: PlayerGameStatsData = {
        gameStatsId,
        userId: player.meta.id,
        finalScore: player.score,
        placement: null, // Will be calculated after all players are saved
        joinedAt: gameStartedAt, // For now, use game start time
        leftAt:
          player.gameStatus === PlayerGameStatus.DISCONNECTED
            ? new Date() // If disconnected, mark as left
            : null,
        questionsAnswered,
        correctAnswers,
        wrongAnswers,
      };

      playerStatsData.push(playerData);
    }

    // Save all player statistics
    await this.repository.saveMany(playerStatsData);

    // Calculate and update placements based on final scores
    await this.repository.updatePlacements(gameStatsId);

    this.logger.info("Player game statistics collected successfully", {
      prefix: "[PLAYER_GAME_STATS]: ",
      gameId: game.id,
      playersCount: playerStatsData.length,
    });
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

  /**
   * Calculate number of correct answers for a player in a game
   */
  private _calculateCorrectAnswers(game: Game, playerId: number): number {
    // For now, we'll use a simple heuristic since we don't have detailed answer tracking yet
    // This can be enhanced when we implement more detailed event tracking

    if (!game.gameState?.answeredPlayers) {
      return 0;
    }

    // Count correct answers from the answered players array
    return game.gameState.answeredPlayers.filter(
      (ap) => ap.player === playerId && ap.result > 0
    ).length;
  }

  /**
   * Calculate number of wrong answers for a player in a game
   */
  private _calculateWrongAnswers(game: Game, playerId: number): number {
    if (!game.gameState?.answeredPlayers) {
      return 0;
    }

    // Count wrong answers from the answered players array
    return game.gameState.answeredPlayers.filter(
      (ap) => ap.player === playerId && ap.result < 0
    ).length;
  }
}
