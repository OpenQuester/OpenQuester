/**
 * Interface for player game statistics data stored in Redis
 * All values in Redis are stored as strings, so this interface reflects that
 */
export interface PlayerGameStatsRedisData {
  /** Game ID this session belongs to */
  gameId: string;

  /** User ID for this session */
  userId: string;

  /** ISO timestamp when player joined the game */
  joinedAt: string;

  /** ISO timestamp when player left the game (empty string if still in game) */
  leftAt: string;

  /** Current player score */
  currentScore: string;

  /** Total number of questions the player has answered */
  questionsAnswered: string;

  /** Number of questions answered correctly */
  correctAnswers: string;

  /** Number of questions answered incorrectly */
  wrongAnswers: string;
}

/**
 * Partial interface for updating Redis data - allows partial updates
 */
export interface PlayerGameStatsRedisUpdate {
  /** Game ID this session belongs to */
  gameId?: string;

  /** User ID for this session */
  userId?: string;

  /** ISO timestamp when player joined the game */
  joinedAt?: string;

  /** ISO timestamp when player left the game (null becomes empty string in Redis) */
  leftAt?: string | null;

  /** Current player score */
  currentScore?: string | number;

  /** Player's current score (alias for compatibility) */
  score?: string | number;

  /** Total number of questions the player has answered */
  questionsAnswered?: string | number;

  /** Number of questions answered correctly */
  correctAnswers?: string | number;

  /** Number of questions answered incorrectly */
  wrongAnswers?: string | number;
}
