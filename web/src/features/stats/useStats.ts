import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

type S = components["schemas"];
export type UserStats = S["UserStats"];
export type LeaderboardEntry = S["LeaderboardEntry"];
export type LeaderboardPeriod = S["LeaderboardPeriod"];
export type QuestionReport = S["QuestionReport"];
export type QuestionReportReason = S["QuestionReportReason"];

export const REPORT_REASONS: QuestionReportReason[] = [
  "wrong_answer",
  "broken_media",
  "offensive",
  "other",
];

export function useMyStats(enabled = true) {
  return useQuery({
    queryKey: ["stats", "me"],
    enabled,
    queryFn: () => unwrap(api.GET("/v1/stats/me")),
  });
}

export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: ["stats", "leaderboard", period],
    queryFn: () =>
      unwrap(api.GET("/v1/stats/leaderboard", { params: { query: { period, limit: 50 } } })),
    select: (r) => r.data,
  });
}

/** Share of answers that were right, as a whole percent, or null with no answers yet. */
export function accuracy(stats: Pick<UserStats, "correctAnswers" | "wrongAnswers">): number | null {
  const total = stats.correctAnswers + stats.wrongAnswers;
  return total === 0 ? null : Math.round((stats.correctAnswers / total) * 100);
}

export function useReportQuestion(gameId: string) {
  return useMutation({
    mutationFn: (body: { questionId: number; reason: QuestionReportReason; comment?: string }) =>
      unwrap(api.POST("/v1/games/{gameId}/reports", { params: { path: { gameId } }, body })),
  });
}

const reportsKey = (packageId: number) => ["packages", packageId, "reports"] as const;

export function usePackageReports(packageId: number, enabled = true) {
  return useQuery({
    queryKey: reportsKey(packageId),
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      unwrap(api.GET("/v1/packages/{id}/reports", { params: { path: { id: packageId } } })),
  });
}

export function useResolveReport(packageId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, resolved }: { reportId: number; resolved: boolean }) =>
      unwrap(
        api.PATCH("/v1/packages/{id}/reports/{reportId}", {
          params: { path: { id: packageId, reportId } },
          body: { resolved },
        }),
      ),
    onSettled: () => void qc.invalidateQueries({ queryKey: reportsKey(packageId) }),
  });
}
