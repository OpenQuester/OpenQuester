import { gameEntryStyles } from "../gameEntryStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";

import type { GameListItem } from "@/api/types";
import { playerCount, type GameStatus } from "@/features/home/useGames";
import { Badge } from "@/ui/Badge";
import { LockIcon } from "@/ui/icons";

export function JoinSummary({ game, status }: { game: GameListItem; status: GameStatus }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <div className={layoutStyles.actions}>
        <Badge tone={status === "lobby" ? "success" : "accent"}>
          {status === "lobby"
            ? t("home.status.lobby")
            : status === "playing"
              ? t("home.status.playing")
              : t("join.finished")}
        </Badge>
        {game.isPrivate && (
          <Badge>
            <LockIcon size={14} /> {t("home.private")}
          </Badge>
        )}
      </div>
      <h1 className={gameEntryStyles.title}>{game.title}</h1>
      <p className="m-0 text-muted">
        {t("home.package", { title: game.package.title })} ·{" "}
        {t("home.host", { name: game.createdBy.username })} ·{" "}
        <span className="font-mono text-text">
          {playerCount(game)}/{game.maxPlayers}
        </span>{" "}
        {t("home.players")}
      </p>
    </div>
  );
}
