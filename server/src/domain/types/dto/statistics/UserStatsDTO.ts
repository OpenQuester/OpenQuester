/** One finished game in a player's history */
export interface UserRecentGameDTO {
  gameId: string;
  finishedAt: Date;
  finalScore: number;
  placement: number | null;
  totalPlayers: number | null;
}

/** Totals over every finished game a user played in */
export interface UserStatsDTO {
  userId: number;
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  recentGames: UserRecentGameDTO[];
}

export enum LeaderboardPeriod {
  ALL = "all",
  MONTH = "month",
  WEEK = "week"
}

export interface LeaderboardEntryDTO {
  rank: number;
  user: { id: number; username: string; name: string | null; avatar: string | null };
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  correctAnswers: number;
}
