import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { seatedPlayers } from "@/game/selectors";
import { useSession } from "../../GameContext";

export function MediaWait() {
  const { t } = useTranslation();
  const session = useSession();
  const players = seatedPlayers(session).filter((p) => p.status === "in-game");
  const ready = players.filter((p) => p.mediaDownloaded).length;
  return (
    <div className={questionStyles.unavailableMedia}>
      <span className="font-display text-2xl font-extrabold">{t("question.getReady")}</span>
      <span className="text-muted">
        {t("question.mediaReady", { ready, total: players.length })}
      </span>
    </div>
  );
}
