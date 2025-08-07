/**
 * Player game statistics data interface for individual player performance tracking
 */
export interface PlayerGameStatsData {
  gameStatsId: number;
  userId: number;
  finalScore: number;
  placement: number | null;
  joinedAt: Date;
  leftAt: Date | null;
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
}
