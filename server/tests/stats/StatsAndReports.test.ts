import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Express } from "express";
import { type Repository } from "typeorm";

import { HttpStatus } from "domain/enums/HttpStatus";
import {
  type QuestionReportDTO,
  QuestionReportReason
} from "domain/types/dto/report/QuestionReportDTO";
import {
  type LeaderboardEntryDTO,
  type UserStatsDTO
} from "domain/types/dto/statistics/UserStatsDTO";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { User } from "infrastructure/database/models/User";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import { SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Player stats, leaderboard and question reports", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let http: HttpTestClient;
  let userRepo: Repository<User>;
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    utils = suite.utils;
    userRepo = suite.userRepo;
    http = createHttpTestClient(suite.serverUrl);
  });

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  let accounts = 0;
  const signIn = (name: string) =>
    utils.createAndLoginUser(userRepo, app, `${name}_${Date.now()}_${++accounts}`);

  /** Saves a finished game with each player's score and placement. */
  async function finishedGame(
    finishedAt: Date,
    results: { user: User; score: number; placement: number; correct?: number; wrong?: number }[]
  ): Promise<void> {
    const ds = suite.dataSource;
    const game = await ds.getRepository(GameStatistics).save(
      ds.getRepository(GameStatistics).create({
        game_id: `stats-${Date.now()}-${++accounts}`,
        started_at: new Date(finishedAt.getTime() - 60_000),
        finished_at: finishedAt,
        created_by: results[0].user.id,
        duration: 60_000,
        total_players: results.length
      })
    );
    await ds.getRepository(PlayerGameStats).save(
      results.map((r) =>
        ds.getRepository(PlayerGameStats).create({
          game_stats_id: game.id,
          user_id: r.user.id,
          final_score: r.score,
          placement: r.placement,
          joined_at: game.started_at,
          questions_answered: (r.correct ?? 0) + (r.wrong ?? 0),
          correct_answers: r.correct ?? 0,
          wrong_answers: r.wrong ?? 0
        })
      )
    );
  }

  it("totals a player's games and lists the latest first", async () => {
    await suite.scenario(async () => {
      const alice = await signIn("alice");
      const bob = await signIn("bob");
      const now = Date.now();
      await finishedGame(new Date(now - 2 * DAY_MS), [
        { user: alice.user, score: 300, placement: 1, correct: 3, wrong: 1 },
        { user: bob.user, score: 100, placement: 2, correct: 1 }
      ]);
      await finishedGame(new Date(now - DAY_MS), [
        { user: bob.user, score: 500, placement: 1, correct: 4 },
        { user: alice.user, score: -100, placement: 2, wrong: 1 }
      ]);

      const mine = await http.get("/v1/stats/me").set("Cookie", alice.cookie);
      expect(mine.status).toBe(HttpStatus.OK);
      const stats = mine.body as UserStatsDTO;
      expect(stats).toMatchObject({
        userId: alice.user.id,
        gamesPlayed: 2,
        wins: 1,
        totalScore: 200,
        bestScore: 300,
        questionsAnswered: 5,
        correctAnswers: 3,
        wrongAnswers: 2
      });
      expect(stats.recentGames.map((g) => g.finalScore)).toEqual([-100, 300]);
      expect(stats.recentGames[0]).toMatchObject({ placement: 2, totalPlayers: 2 });

      // Anyone signed in can see another player's totals
      const other = await http.get(`/v1/stats/users/${bob.user.id}`).set("Cookie", alice.cookie);
      expect(other.body).toMatchObject({ gamesPlayed: 2, wins: 1, totalScore: 600 });

      // A player with no games gets zeros, not an error
      const fresh = await signIn("fresh");
      const empty = await http.get("/v1/stats/me").set("Cookie", fresh.cookie);
      expect(empty.body).toMatchObject({ gamesPlayed: 0, wins: 0, totalScore: 0, recentGames: [] });
    });
  });

  it("adds up scores beyond the int range in totals and the leaderboard", async () => {
    await suite.scenario(async () => {
      const big = await signIn("big");
      const now = Date.now();
      const score = 2_100_000_000;
      await finishedGame(new Date(now - 2 * DAY_MS), [{ user: big.user, score, placement: 1 }]);
      await finishedGame(new Date(now - DAY_MS), [{ user: big.user, score, placement: 1 }]);

      const mine = await http.get("/v1/stats/me").set("Cookie", big.cookie);
      expect(mine.status).toBe(HttpStatus.OK);
      expect((mine.body as UserStatsDTO).totalScore).toBe(2 * score);

      const board = await http.get("/v1/stats/leaderboard?limit=100").set("Cookie", big.cookie);
      expect(board.status).toBe(HttpStatus.OK);
      const entry = (board.body.data as LeaderboardEntryDTO[]).find(
        (row) => row.user.id === big.user.id
      );
      expect(entry?.totalScore).toBe(2 * score);
    });
  });

  it("ranks the leaderboard by wins, then score, and filters by period", async () => {
    await suite.scenario(async () => {
      const carol = await signIn("carol");
      const dave = await signIn("dave");
      const erin = await signIn("erin");
      const now = Date.now();
      // Dave wins twice, but one of them was long ago
      await finishedGame(new Date(now - 60 * DAY_MS), [
        { user: dave.user, score: 900, placement: 1 },
        { user: carol.user, score: 0, placement: 2 }
      ]);
      await finishedGame(new Date(now - DAY_MS), [
        { user: dave.user, score: 200, placement: 1 },
        { user: carol.user, score: 100, placement: 2 }
      ]);
      await finishedGame(new Date(now - DAY_MS), [
        { user: carol.user, score: 400, placement: 1 },
        { user: erin.user, score: 50, placement: 2 }
      ]);

      const ours = (entries: LeaderboardEntryDTO[]) =>
        entries
          .filter((e) => [carol, dave, erin].some((a) => Number(a.user.id) === e.user.id))
          .map((e) => e.user.username);

      const all = await http.get("/v1/stats/leaderboard?limit=100").set("Cookie", carol.cookie);
      expect(all.status).toBe(HttpStatus.OK);
      expect(ours(all.body.data)).toEqual([
        dave.user.username,
        carol.user.username,
        erin.user.username
      ]);
      const first = (all.body.data as LeaderboardEntryDTO[])[0];
      expect(first.rank).toBe(1);

      // This week both have one win; Carol scored more
      const week = await http
        .get("/v1/stats/leaderboard?period=week&limit=100")
        .set("Cookie", carol.cookie);
      expect(ours(week.body.data)).toEqual([
        carol.user.username,
        dave.user.username,
        erin.user.username
      ]);

      const bad = await http.get("/v1/stats/leaderboard?period=year").set("Cookie", carol.cookie);
      expect(bad.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  it("lets a player report a question and the author resolve it", async () => {
    await suite.scenario(async () => {
      const { gameId, showmanSocket, showmanUser, playerUsers } =
        await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
      await utils.startGame(showmanSocket);
      const questionId = await utils.getFirstAvailableQuestionId(gameId);
      const player = await utils.loginExistingUser(app, playerUsers[0].id);
      const author = await utils.loginExistingUser(app, showmanUser.id);

      const sent = await http
        .post(`/v1/games/${gameId}/reports`)
        .set("Cookie", player.cookie)
        .send({ questionId, reason: QuestionReportReason.WRONG_ANSWER, comment: " It's 1945 " });
      expect(sent.status).toBe(HttpStatus.OK);
      const report = sent.body as QuestionReportDTO;
      expect(report).toMatchObject({
        questionId,
        reason: QuestionReportReason.WRONG_ANSWER,
        comment: "It's 1945",
        resolved: false,
        reporter: { id: playerUsers[0].id }
      });

      // One open report per question per player
      const again = await http
        .post(`/v1/games/${gameId}/reports`)
        .set("Cookie", player.cookie)
        .send({ questionId, reason: QuestionReportReason.OTHER });
      expect(again.status).toBe(HttpStatus.CONFLICT);

      const unknown = await http
        .post(`/v1/games/${gameId}/reports`)
        .set("Cookie", player.cookie)
        .send({ questionId: 999999999, reason: QuestionReportReason.OTHER });
      expect(unknown.status).toBe(HttpStatus.NOT_FOUND);

      // Only the author (or an editor) reads the reports
      const forbidden = await http
        .get(`/v1/packages/${report.packageId}/reports`)
        .set("Cookie", player.cookie);
      expect(forbidden.status).toBe(HttpStatus.FORBIDDEN);

      const list = await http
        .get(`/v1/packages/${report.packageId}/reports`)
        .set("Cookie", author.cookie);
      expect(list.status).toBe(HttpStatus.OK);
      expect(list.body.open).toBe(1);
      expect(list.body.data.map((r: QuestionReportDTO) => r.id)).toEqual([report.id]);

      const resolved = await http
        .patch(`/v1/packages/${report.packageId}/reports/${report.id}`)
        .set("Cookie", author.cookie)
        .send({ resolved: true });
      expect(resolved.status).toBe(HttpStatus.OK);
      expect(resolved.body.resolved).toBe(true);

      const after = await http
        .get(`/v1/packages/${report.packageId}/reports`)
        .set("Cookie", author.cookie);
      expect(after.body.open).toBe(0);

      // Once resolved, the player may report it again
      const reopened = await http
        .post(`/v1/games/${gameId}/reports`)
        .set("Cookie", player.cookie)
        .send({ questionId, reason: QuestionReportReason.BROKEN_MEDIA });
      expect(reopened.status).toBe(HttpStatus.OK);
    });
  });
});
