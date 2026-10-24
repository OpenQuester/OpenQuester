import { gamePanelStyles } from "../gamePanelStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { SkipRoundButton } from "../SkipRoundButton";
import type { HostToolsModel } from "./useHostTools";
export function HostGameControls({
  tools,
  onBoardEdit,
}: {
  tools: HostToolsModel;
  onBoardEdit?: () => void;
}) {
  const { t } = useTranslation();
  const { connection, phase, paused, boardEdit, setBoardEdit, canUndo } = tools;
  return (
    <section className={gamePanelStyles.hostActions} aria-label={t("menu.host")}>
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
  );
}
