import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { Database } from "infrastructure/database/Database";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";

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

/** A row as PostgreSQL returns it: bigint aggregates come back as strings. */
type RawRow<T> = { [K in keyof T]: T[K] | string };

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
    // Aggregation without GROUP BY always returns one row, including for new players.
    const totals = await this.ds
      .getRepository(PlayerGameStats)
      .createQueryBuilder("stats")
      .select("COUNT(*)::int", "gamesPlayed")
      .addSelect("COUNT(*) FILTER (WHERE stats.placement = 1)::int", "wins")
      .addSelect("COALESCE(SUM(stats.final_score), 0)::bigint", "totalScore")
      .addSelect("COALESCE(MAX(stats.final_score), 0)::int", "bestScore")
      .addSelect("COALESCE(SUM(stats.questions_answered), 0)::bigint", "questionsAnswered")
      .addSelect("COALESCE(SUM(stats.correct_answers), 0)::bigint", "correctAnswers")
      .addSelect("COALESCE(SUM(stats.wrong_answers), 0)::bigint", "wrongAnswers")
      .where("stats.user_id = :userId", { userId })
      .getRawOne<RawRow<UserTotalsRow>>();

    return {
      gamesPlayed: Number(totals!.gamesPlayed),
      wins: Number(totals!.wins),
      totalScore: Number(totals!.totalScore),
      bestScore: Number(totals!.bestScore),
      questionsAnswered: Number(totals!.questionsAnswered),
      correctAnswers: Number(totals!.correctAnswers),
      wrongAnswers: Number(totals!.wrongAnswers)
    };
  }

  public async getRecentGames(userId: number, limit: number): Promise<RecentGameRow[]> {
    return this.ds
      .getRepository(PlayerGameStats)
      .createQueryBuilder("stats")
      .innerJoin("stats.gameStats", "game")
      .select("game.game_id", "gameId")
      .addSelect("game.finished_at", "finishedAt")
      .addSelect("stats.final_score", "finalScore")
      .addSelect("stats.placement", "placement")
      .addSelect("game.total_players", "totalPlayers")
      .where("stats.user_id = :userId", { userId })
      .orderBy("game.finished_at", "DESC")
      .limit(limit)
      .getRawMany<RecentGameRow>();
  }

  /** Wins rank first, then score; only active registered accounts appear. */
  public async getLeaderboard(since: Date | null, limit: number): Promise<LeaderboardRow[]> {
    const query = this.ds
      .getRepository(PlayerGameStats)
      .createQueryBuilder("stats")
      .innerJoin("stats.gameStats", "game")
      .innerJoin("stats.user", "user")
      .leftJoin("user.avatar", "avatar")
      .select("user.id", "userId")
      .addSelect("user.username", "username")
      .addSelect("user.name", "name")
      .addSelect("avatar.filename", "avatarFilename")
      .addSelect("COUNT(*)::int", "gamesPlayed")
      .addSelect("COUNT(*) FILTER (WHERE stats.placement = 1)::int", "wins")
      .addSelect("COALESCE(SUM(stats.final_score), 0)::bigint", "totalScore")
      .addSelect("COALESCE(SUM(stats.correct_answers), 0)::bigint", "correctAnswers")
      .where("user.is_guest = :excluded", { excluded: false })
      .andWhere("user.is_deleted = :excluded")
      .andWhere("user.is_banned = :excluded")
      .groupBy("user.id")
      .addGroupBy("user.username")
      .addGroupBy("user.name")
      .addGroupBy("avatar.filename")
      .orderBy('"wins"', "DESC")
      .addOrderBy('"totalScore"', "DESC")
      .addOrderBy("user.id", "ASC")
      .limit(limit);

    if (since !== null) {
      query.andWhere("game.finished_at >= :since", { since });
    }

    const rows = await query.getRawMany<RawRow<LeaderboardRow>>();

    // Sums are bigint (two big scores overflow int), which arrives as a string
    return rows.map((row) => ({
      userId: Number(row.userId),
      username: String(row.username),
      name: row.name === null ? null : String(row.name),
      avatarFilename: row.avatarFilename === null ? null : String(row.avatarFilename),
      gamesPlayed: Number(row.gamesPlayed),
      wins: Number(row.wins),
      totalScore: Number(row.totalScore),
      correctAnswers: Number(row.correctAnswers)
    }));
  }
}
