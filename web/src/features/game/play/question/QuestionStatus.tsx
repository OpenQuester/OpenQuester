import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { canBuzz, myRole, seatedPlayers } from "@/game/selectors";
import { useCountdown } from "@/lib/useCountdown";
import { useGame, useSession } from "../../GameContext";
import { useBuzzer } from "../useBuzzer";

/** What happens now that the content has played: who can buzz, and how long is left. */
export function BuzzerCue() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const s = session.state;
  const role = myRole(session, myId);
  const buzzer = useBuzzer(session, myId);
  const { left } = useCountdown(s.timer, s.isPaused);
  const can = canBuzz(session, myId);
  const seconds = left != null ? Math.ceil(left / 1000) : null;
  const help =
    role === "showman"
      ? t("question.cue.showman")
      : role === "spectator"
        ? t("question.cue.spectator")
        : can.ok
          ? t("question.cue.player")
          : can.reason === "false_start"
            ? t("dock.showing.locked", { seconds: Math.ceil(buzzer.lockLeftMs / 1000) })
            : t(`reasons.${can.reason}`);
  return (
    <div className={questionStyles.answeringNotice} role="status" data-testid="buzzer-cue">
      <span className={questionStyles.questionPrice}>
        {buzzer.open ? t("question.cue.open") : t("question.cue.soon")}
      </span>
      <span className="text-soft 3xl:text-xl">{help}</span>
      {seconds != null && seconds > 0 && (
        <span className="text-sm text-muted" data-testid="buzzer-cue-time">
          {t("question.cue.timeLeft", { seconds })}
        </span>
      )}
    </div>
  );
}

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
