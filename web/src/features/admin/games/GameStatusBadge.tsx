import { useTranslation } from "react-i18next";
import type { GameListItem } from "@/api/types";
import { gameStatus } from "@/features/home/useGames";
import { Badge } from "@/ui/Badge";

export function GameStatusBadge({ game, paused }: { game: GameListItem; paused?: boolean }) {
  const { t } = useTranslation();
  const status = gameStatus(game);
  if (status === "finished") return <Badge>{t("adminPanel.gameFinished")}</Badge>;
  if (status === "lobby") return <Badge tone="info">{t("home.status.lobby")}</Badge>;
  if (paused) return <Badge tone="warning">{t("adminPanel.gamePaused")}</Badge>;
  return <Badge tone="success">{t("home.status.playing")}</Badge>;
}
