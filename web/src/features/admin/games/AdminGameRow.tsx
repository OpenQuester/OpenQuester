import { adminStyles } from "../adminStyles";
import { useTranslation } from "react-i18next";
import type { GameListItem } from "@/api/types";
import { playerCount } from "@/features/home/useGames";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { GameStatusBadge } from "./GameStatusBadge";
import { AdminGameDetailsPanel } from "./AdminGameDetailsPanel";

export function AdminGameRow({
  game,
  open,
  onToggle,
}: {
  game: GameListItem;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className={adminStyles.game} data-testid="admin-game" data-game-id={game.id}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className={adminStyles.gameSummary}>
          <span className="truncate font-semibold">{game.title}</span>
          <span className="truncate text-sm text-muted">
            {game.id} · {t("home.host", { name: game.createdBy.username })} ·{" "}
            {timeAgo(game.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <GameStatusBadge game={game} />
          {game.isPrivate && <Badge>{t("home.private")}</Badge>}
          <Badge>
            {t("adminPanel.playersCount", { count: playerCount(game), max: game.maxPlayers })}
          </Badge>
        </div>
        <Button size="sm" aria-expanded={open} onClick={onToggle}>
          {open ? t("common.close") : t("adminPanel.manage")}
        </Button>
      </div>
      {open && <AdminGameDetailsPanel gameId={game.id} />}
    </li>
  );
}
