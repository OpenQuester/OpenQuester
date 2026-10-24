import { homeStyles } from "./homeStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { GameListItem } from "@/api/types";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { LockIcon } from "@/ui/icons";
import { gameStatus, playerCount, type GameStatus } from "./useGames";

export function GameCard({ game }: { game: GameListItem }) {
  const { t } = useTranslation();
  const status: GameStatus = gameStatus(game);
  const full = playerCount(game) >= game.maxPlayers;
  const canPlay = !full && status !== "finished";
  return (
    <li className={homeStyles.game} data-testid="game-card">
      <div className="flex items-center gap-2">
        <Badge tone={status === "lobby" ? "success" : "accent"}>
          {status === "lobby" ? t("home.status.lobby") : t("home.status.playing")}
        </Badge>
        {game.isPrivate && (
          <Badge tone="neutral">
            <LockIcon size={14} /> {t("home.private")}
          </Badge>
        )}
        <span className="ml-auto text-[13px] text-muted">
          {timeAgo(game.startedAt ?? game.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={homeStyles.gameTitle}>{game.title}</h3>
        <p className={homeStyles.gameMeta}>{t("home.package", { title: game.package.title })}</p>
      </div>
      <div className={homeStyles.gameDetails}>
        <span>
          <span className="font-mono text-text">
            {playerCount(game)}/{game.maxPlayers}
          </span>{" "}
          {t("home.players")}
        </span>
        <span aria-hidden="true">·</span>
        <span>{t("home.host", { name: game.createdBy.username })}</span>
      </div>
      <Link
        to="/games/$gameId"
        params={{ gameId: game.id }}
        className={homeStyles.joinLink}
        aria-label={`${canPlay ? t("home.join") : t("home.watch")}: ${game.title}`}
      >
        {canPlay ? t("home.join") : t("home.watch")}
      </Link>
    </li>
  );
}
