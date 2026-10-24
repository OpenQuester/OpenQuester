import { homeStyles } from "./homeStyles";
import { linkStyles } from "@/ui/linkStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { GameListItem } from "@/api/types";
import { Button } from "@/ui/Button";
import { gameStatus } from "./useGames";

export function RejoinGame({ game, onHide }: { game: GameListItem; onHide: () => void }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("home.inProgress")} className={homeStyles.rejoinNotice}>
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
      <div className={homeStyles.rejoinSummary}>
        <span className="font-semibold">{t("home.stillIn", { title: game.title })}</span>
        <span className="text-sm text-on-accent-surface">
          {gameStatus(game) === "lobby" ? t("home.stillInLobby") : t("home.stillInPlaying")}
        </span>
      </div>
      <Link to="/games/$gameId" params={{ gameId: game.id }} className={linkStyles.rejoin}>
        {t("home.rejoin")}
      </Link>
      <Button variant="ghost" className="border-accent-line text-accent-soft" onClick={onHide}>
        {t("home.hideRejoin")}
      </Button>
    </section>
  );
}
