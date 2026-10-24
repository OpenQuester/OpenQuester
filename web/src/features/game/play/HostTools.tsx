import { useTranslation } from "react-i18next";

import { phaseOf } from "@/game/selectors";
import type { GameJoinMode } from "@/game/protocol";
import { useGameStore } from "@/game/store";
import { Button } from "@/ui/Button";
import { Label, Select } from "@/ui/Field";

import { DeleteGameButton } from "../DeleteGameButton";
import { useGame, useSession } from "../GameContext";
import { PlayersBody } from "./PlayersPanel";
import { SkipRoundButton } from "./SkipRoundButton";

/**
 * Showman tools: game controls and player management in one place, so a
 * pinned panel covers everything the host does besides judging.
 */
export function HostTools({
  focusPlayer,
  onBoardEdit,
}: {
  focusPlayer?: number | null;
  /** Called when board editing starts; a sheet closes so the board is reachable. */
  onBoardEdit?: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection } = useGame();
  const phase = phaseOf(session);
  const paused = session.state.isPaused;
  const boardEdit = useGameStore((s) => s.boardEdit);
  const setBoardEdit = useGameStore((s) => s.setBoardEdit);
  // A ruling on the current question can be taken back while it's open or shown
  const lastRuling =
    (session.state.answeredPlayers ?? []).length > 0 ||
    !!session.state.answerShowData?.answerResult;
  const canUndo = (phase === "showing" || phase === "reveal") && lastRuling;

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
          {canUndo && (
            <Button
              size="sm"
              onClick={() => connection.emit("answer-result-undo")}
              data-testid="undo-ruling"
            >
              {t("menu.undoRuling")}
            </Button>
          )}
          {phase === "choosing" && (
            <Button
              size="sm"
              variant={boardEdit ? "accent" : "secondary"}
              aria-pressed={boardEdit}
              onClick={() => {
                if (!boardEdit) onBoardEdit?.();
                setBoardEdit(!boardEdit);
              }}
              data-testid="board-edit"
            >
              {boardEdit ? t("menu.boardEditDone") : t("menu.boardEdit")}
            </Button>
          )}
          <SkipRoundButton size="sm" label={t("menu.nextRound")} />
        </section>
      )}
      {phase !== "finished" && (
        <section className="flex flex-col gap-2 border-b border-line p-4">
          <Label htmlFor="join-mode">{t("menu.joinMode")}</Label>
          <Select
            id="join-mode"
            value={session.state.joinMode ?? "open"}
            onChange={(e) =>
              connection.emit("game-join-mode-change", { joinMode: e.target.value as GameJoinMode })
            }
          >
            {(["open", "spectators_only", "closed"] as const).map((m) => (
              <option key={m} value={m}>
                {t(`menu.joinModes.${m}`)}
              </option>
            ))}
          </Select>
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
