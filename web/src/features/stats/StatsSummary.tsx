import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatScore, formatSigned, timeAgo } from "@/lib/format";
import { Spinner } from "@/ui/Spinner";

import { accuracy, useMyStats } from "./useStats";

/** The signed-in player's totals and latest games, for the profile page. */
export function StatsSummary() {
  const { t } = useTranslation();
  const stats = useMyStats();

  if (stats.isLoading) return <Spinner label={t("common.loading")} />;
  if (!stats.data) return <p className="m-0 text-sm text-danger">{t("stats.loadFailed")}</p>;

  const s = stats.data;
  const acc = accuracy(s);
  const tiles = [
    { label: t("stats.games"), value: formatScore(s.gamesPlayed) },
    { label: t("stats.wins"), value: formatScore(s.wins) },
    { label: t("stats.totalScore"), value: formatScore(s.totalScore) },
    { label: t("stats.bestScore"), value: formatScore(s.bestScore) },
    { label: t("stats.accuracy"), value: acc == null ? "—" : `${acc}%` },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="my-stats">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-xl font-semibold">{t("stats.title")}</h2>
        <Link to="/leaderboard" className="text-sm">
          {t("stats.seeLeaderboard")}
        </Link>
      </div>
      {s.gamesPlayed === 0 ? (
        <p className="m-0 text-soft">{t("stats.noGames")}</p>
      ) : (
        <>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col rounded-md bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-muted">{tile.label}</dt>
                <dd className="m-0 font-display text-2xl font-bold tabular-nums">{tile.value}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-sm text-muted">
            {t("stats.answers", { right: s.correctAnswers, wrong: s.wrongAnswers })}
          </p>
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-base font-semibold">{t("stats.recent")}</h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {s.recentGames.map((g) => (
                <li
                  key={g.gameId}
                  className="flex flex-wrap items-center justify-between gap-x-4 border-b border-line py-2 last:border-b-0"
                >
                  <span className="text-sm">
                    {g.placement === 1
                      ? t("stats.won")
                      : g.placement != null
                        ? t("stats.place", { place: g.placement, players: g.totalPlayers ?? "?" })
                        : t("stats.played")}
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <span className="font-semibold tabular-nums">{formatSigned(g.finalScore)}</span>
                    <span className="text-muted">{timeAgo(g.finishedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
