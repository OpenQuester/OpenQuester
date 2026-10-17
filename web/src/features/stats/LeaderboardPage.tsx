import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";

import { type LeaderboardPeriod, useLeaderboard } from "./useStats";

const PERIODS: LeaderboardPeriod[] = ["week", "month", "all"];

/** Top players by wins, then total score. */
export function LeaderboardPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const board = useLeaderboard(period);

  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-4xl font-extrabold tracking-tight">
            {t("leaderboard.title")}
          </h1>
          <p className="m-0 text-muted">{t("leaderboard.help")}</p>
        </div>
        <div role="tablist" aria-label={t("leaderboard.period")} className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={cn(
                "min-h-11 rounded-sm px-4 font-medium",
                period === p ? "bg-surface-2 text-text" : "text-muted hover:text-text",
              )}
            >
              {t(`leaderboard.periods.${p}`)}
            </button>
          ))}
        </div>

        {board.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : board.isError ? (
          <p role="alert" className="text-danger">
            {t("leaderboard.loadFailed")}
          </p>
        ) : !board.data?.length ? (
          <Card>
            <p className="m-0 text-soft">{t("leaderboard.empty")}</p>
          </Card>
        ) : (
          <Card className="p-0 sm:p-0">
            <table className="w-full border-collapse text-left" data-testid="leaderboard">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-2 py-3 font-medium">{t("leaderboard.player")}</th>
                  <th className="px-2 py-3 text-right font-medium">{t("stats.wins")}</th>
                  <th className="hidden px-2 py-3 text-right font-medium sm:table-cell">
                    {t("stats.games")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t("stats.totalScore")}</th>
                </tr>
              </thead>
              <tbody>
                {board.data.map((e) => {
                  const name = e.user.name || e.user.username;
                  const isMe = me.data?.id === e.user.id;
                  return (
                    <tr
                      key={e.user.id}
                      className={cn("border-t border-line", isMe && "bg-accent-surface")}
                      aria-current={isMe ? "true" : undefined}
                    >
                      <td className="px-4 py-2.5 font-display text-lg font-bold tabular-nums">
                        {e.rank}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={name} src={e.user.avatar} size={32} />
                          <span className="truncate font-semibold">{name}</span>
                          {isMe && (
                            <span className="text-xs text-muted">{t("leaderboard.you")}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatScore(e.wins)}</td>
                      <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">
                        {formatScore(e.gamesPlayed)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatScore(e.totalScore)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
