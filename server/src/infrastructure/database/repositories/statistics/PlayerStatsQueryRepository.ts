import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { Database } from "infrastructure/database/Database";

export interface UserTotalsRow {
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
}

export interface RecentGameRow {
  gameId: string;
  finishedAt: Date;
  finalScore: number;
  placement: number | null;
  totalPlayers: number | null;
}

export interface LeaderboardRow {
  userId: number;
  username: string;
  name: string | null;
  avatarFilename: string | null;
  gamesPlayed: number;
  wins: number;
  totalScore: number;
  correctAnswers: number;
}

const USER_TOTALS_SQL = `
  SELECT COUNT(*)::int AS "gamesPlayed",
         COUNT(*) FILTER (WHERE s."placement" = 1)::int AS "wins",
         COALESCE(SUM(s."final_score"), 0)::int AS "totalScore",
         COALESCE(MAX(s."final_score"), 0)::int AS "bestScore",
         COALESCE(SUM(s."questions_answered"), 0)::int AS "questionsAnswered",
         COALESCE(SUM(s."correct_answers"), 0)::int AS "correctAnswers",
         COALESCE(SUM(s."wrong_answers"), 0)::int AS "wrongAnswers"
  FROM "player_game_stats" s
  WHERE s."user_id" = $1`;

const RECENT_GAMES_SQL = `
  SELECT g."game_id" AS "gameId", g."finished_at" AS "finishedAt",
         s."final_score" AS "finalScore", s."placement", g."total_players" AS "totalPlayers"
  FROM "player_game_stats" s
  JOIN "game_statistics" g ON g."id" = s."game_stats_id"
  WHERE s."user_id" = $1
  ORDER BY g."finished_at" DESC
  LIMIT $2`;

/** Wins rank first, then total score; guests, deleted and banned accounts are left out. */
const LEADERBOARD_SQL = `
  SELECT u."id" AS "userId", u."username", u."name", f."filename" AS "avatarFilename",
         COUNT(*)::int AS "gamesPlayed",
         COUNT(*) FILTER (WHERE s."placement" = 1)::int AS "wins",
         COALESCE(SUM(s."final_score"), 0)::int AS "totalScore",
         COALESCE(SUM(s."correct_answers"), 0)::int AS "correctAnswers"
  FROM "player_game_stats" s
  JOIN "game_statistics" g ON g."id" = s."game_stats_id"
  JOIN "user" u ON u."id" = s."user_id"
  LEFT JOIN "file" f ON f."id" = u."avatar"
  WHERE u."is_guest" = false AND u."is_deleted" = false AND u."is_banned" = false
    AND ($1::timestamp IS NULL OR g."finished_at" >= $1)
  GROUP BY u."id", u."username", u."name", f."filename"
  ORDER BY "wins" DESC, "totalScore" DESC, u."id" ASC
  LIMIT $2`;

/** Aggregates over saved player game stats for profiles and the leaderboard. */
@singleton()
export class PlayerStatsQueryRepository {
  constructor(@inject(DI_TOKENS.Database) private readonly db: Database) {
    //
  }

  private get ds() {
    return this.db.dataSource;
  }

  public async getUserTotals(userId: number): Promise<UserTotalsRow> {
    const rows: UserTotalsRow[] = await this.ds.query(USER_TOTALS_SQL, [userId]);
    return rows[0];
  }

  public async getRecentGames(userId: number, limit: number): Promise<RecentGameRow[]> {
    return this.ds.query(RECENT_GAMES_SQL, [userId, limit]);
  }

  public async getLeaderboard(since: Date | null, limit: number): Promise<LeaderboardRow[]> {
    return this.ds.query(LEADERBOARD_SQL, [since, limit]);
  }
}
