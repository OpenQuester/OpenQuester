import { gamePanelStyles } from "../gamePanelStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { SkipRoundButton } from "../SkipRoundButton";
import { GamePauseButton } from "../GamePauseButton";
import type { HostToolsModel } from "./useHostTools";
export function HostGameControls({
  tools,
  onBoardEdit,
}: {
  tools: HostToolsModel;
  onBoardEdit?: () => void;
}) {
  const { t } = useTranslation();
  const { connection, phase, paused, boardEdit, setBoardEdit, canUndo, session } = tools;
  const pausedReason = paused ? t("reasons.paused") : undefined;
  return (
    <section className={gamePanelStyles.hostActions} aria-label={t("menu.host")}>
      {paused && <p className="m-0 basis-full text-sm text-muted">{pausedReason}</p>}
      <GamePauseButton />
      {(phase === "showing" ||
        phase === "answering" ||
        (phase === "media" && session.state.currentRound?.type !== "final") ||
        phase === "stake_bidding" ||
        phase === "all_play_answering" ||
        phase === "secret_transfer") && (
        <Button
          size="sm"
          disabled={paused}
          title={pausedReason}
          onClick={() => connection.emit("skip-question-force")}
        >
          {t("menu.skipQuestion")}
        </Button>
      )}
      {phase === "reveal" && (
        <Button
          size="sm"
          disabled={paused}
          title={pausedReason}
          onClick={() => connection.emit("skip-show-answer")}
        >
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
          disabled={paused}
          title={pausedReason}
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
