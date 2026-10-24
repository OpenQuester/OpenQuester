import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer, PageTitle } from "@/ui/Page";
import { useMe } from "@/features/auth/useMe";
import { cn } from "@/lib/cn";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";

import { type LeaderboardPeriod, useLeaderboard } from "./useStats";

import { LeaderboardTable } from "./LeaderboardTable";

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
          <PageTitle>{t("leaderboard.title")}</PageTitle>
          <p className="m-0 text-muted">{t("leaderboard.help")}</p>
        </div>
        <div role="tablist" aria-label={t("leaderboard.period")} className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              id={`leaderboard-${p}`}
              aria-controls="leaderboard-results"
              tabIndex={period === p ? 0 : -1}
              onKeyDown={onChoiceKeyDown}
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

        <div
          role="tabpanel"
          id="leaderboard-results"
          aria-labelledby={`leaderboard-${period}`}
          tabIndex={0}
        >
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
            <LeaderboardTable entries={board.data} currentUserId={me.data?.id} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
