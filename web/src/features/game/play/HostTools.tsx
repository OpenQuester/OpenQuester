import { useTranslation } from "react-i18next";

import { phaseOf } from "@/game/selectors";
import { Button } from "@/ui/Button";

import { DeleteGameButton } from "../DeleteGameButton";
import { useGame, useSession } from "../GameContext";
import { PlayersBody } from "./PlayersPanel";

/**
 * Showman tools: game controls and player management in one place, so a
 * pinned panel covers everything the host does besides judging.
 */
export function HostTools({ focusPlayer }: { focusPlayer?: number | null }) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection } = useGame();
  const phase = phaseOf(session);
  const paused = session.state.isPaused;

  return (
    <div className="flex flex-col" data-testid="host-panel">
      {phase !== "finished" && (
        <section
          className="flex flex-wrap gap-2 border-b border-line p-4"
          aria-label={t("menu.host")}
        >
          <Button size="sm" onClick={() => connection.emit(paused ? "game-unpause" : "game-pause")}>
            {paused ? t("game.resume") : t("game.pause")}
          </Button>
          {(phase === "showing" ||
            phase === "answering" ||
            phase === "media" ||
            phase === "stake_bidding" ||
            phase === "all_play_answering" ||
            phase === "secret_transfer") && (
            <Button size="sm" onClick={() => connection.emit("skip-question-force")}>
              {t("menu.skipQuestion")}
            </Button>
          )}
          {phase === "reveal" && (
            <Button size="sm" onClick={() => connection.emit("skip-show-answer")}>
              {t("menu.skipReveal")}
            </Button>
          )}
          <Button size="sm" onClick={() => connection.emit("next-round")}>
            {t("menu.nextRound")}
          </Button>
        </section>
      )}
      <PlayersBody compact focusPlayer={focusPlayer} key={focusPlayer ?? "none"} />
      <section className="flex flex-col gap-2 border-t border-line p-4">
        <p className="m-0 text-sm text-muted">{t("menu.hostHelp")}</p>
        <DeleteGameButton gameId={session.gameId} />
      </section>
    </div>
  );
}
