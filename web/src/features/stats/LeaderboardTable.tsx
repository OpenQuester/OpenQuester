import { statsStyles } from "./statsStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import type { LeaderboardEntry } from "./useStats";

export function LeaderboardTable({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId?: number;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-0 sm:p-0">
      <table className="w-full border-collapse text-left" data-testid="leaderboard">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-2 py-3 font-medium">{t("leaderboard.player")}</th>
            <th className="px-2 py-3 text-right font-medium">{t("stats.wins")}</th>
            <th className={statsStyles.optionalHeading}>{t("stats.games")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("stats.totalScore")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <LeaderboardRow key={entry.user.id} entry={entry} currentUserId={currentUserId} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function LeaderboardRow({
  entry,
  currentUserId,
}: {
  entry: LeaderboardEntry;
  currentUserId?: number;
}) {
  const { t } = useTranslation();
  const name = entry.user.name || entry.user.username;
  const isMe = currentUserId === entry.user.id;
  return (
    <tr
      className={cn("border-t border-line", isMe && "bg-accent-surface")}
      aria-current={isMe ? "true" : undefined}
    >
      <td className={statsStyles.rank}>{entry.rank}</td>
      <td className="px-2 py-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={name} src={entry.user.avatar} size={32} />
          <span className="truncate font-semibold">{name}</span>
          {isMe && <span className="text-xs text-muted">{t("leaderboard.you")}</span>}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums">{formatScore(entry.wins)}</td>
      <td className={statsStyles.optionalValue}>{formatScore(entry.gamesPlayed)}</td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
        {formatScore(entry.totalScore)}
      </td>
    </tr>
  );
}
