import { singleton } from "tsyringe";

import {
  LeaderboardEntryDTO,
  LeaderboardPeriod,
  UserStatsDTO
} from "domain/types/dto/statistics/UserStatsDTO";
import { PlayerStatsQueryRepository } from "infrastructure/database/repositories/statistics/PlayerStatsQueryRepository";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";

const RECENT_GAMES_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Profile totals and the leaderboard, read from saved per-player game stats. */
@singleton()
export class UserStatsService {
  constructor(
    private readonly statsQuery: PlayerStatsQueryRepository,
    private readonly fileUrlBuilder: S3FileUrlBuilder
  ) {
    //
  }

  public async getUserStats(userId: number): Promise<UserStatsDTO> {
    const [totals, recentGames] = await Promise.all([
      this.statsQuery.getUserTotals(userId),
      this.statsQuery.getRecentGames(userId, RECENT_GAMES_LIMIT)
    ]);
    return { userId, ...totals, recentGames };
  }

  public async getLeaderboard(
    period: LeaderboardPeriod,
    limit: number,
    now: Date = new Date()
  ): Promise<LeaderboardEntryDTO[]> {
    const rows = await this.statsQuery.getLeaderboard(this._periodStart(period, now), limit);
    return rows.map((row, index) => ({
      rank: index + 1,
      user: {
        id: row.userId,
        username: row.username,
        avatar: row.avatarFilename ? this.fileUrlBuilder.getUrl(row.avatarFilename) : null
      },
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      totalScore: row.totalScore,
      correctAnswers: row.correctAnswers
    }));
  }

  private _periodStart(period: LeaderboardPeriod, now: Date): Date | null {
    switch (period) {
      case LeaderboardPeriod.WEEK:
        return new Date(now.getTime() - 7 * DAY_MS);
      case LeaderboardPeriod.MONTH:
        return new Date(now.getTime() - 30 * DAY_MS);
      default:
        return null;
    }
  }
}
