import { gameBoardStyles } from "./board/gameBoardStyles";
import { useTranslation } from "react-i18next";
import { findPlayer, myRole } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { Button } from "@/ui/Button";
import { useGame, useSession } from "../GameContext";
import { BoardThemeRow } from "./board/BoardThemeRow";
import { useBoardLayout } from "./board/useBoardLayout";

/** The round board. Cells you can pick now are amber; played cells are empty. */
export function GameBoard() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const boardEdit = useGameStore((s) => s.boardEdit);
  const setBoardEdit = useGameStore((s) => s.setBoardEdit);
  const themes = [...(session.state.currentRound?.themes ?? [])].sort((a, b) => a.order - b.order);
  const picker = findPlayer(session, session.state.currentTurnPlayerId);
  const { ref, columns, stacked, perRow } = useBoardLayout(themes);

  return (
    <section aria-labelledby="board-caption" className="flex flex-1 flex-col gap-3">
      <h2 id="board-caption" className="sr-only">
        {t("board.caption", { round: session.state.currentRound?.name ?? "" })}
        {picker ? `. ${t("board.picker", { name: picker.meta.username })}` : ""}
      </h2>
      {boardEdit && myRole(session, myId) === "showman" && (
        <div className={gameBoardStyles.turnNotice} data-testid="board-edit-hint">
          <span className="min-w-0 flex-1">{t("board.editHint")}</span>
          <Button
            size="sm"
            variant="accent"
            onClick={() => setBoardEdit(false)}
            data-testid="board-edit-done"
          >
            {t("menu.boardEditDone")}
          </Button>
        </div>
      )}
      <div
        ref={ref}
        className="grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: `minmax(0, 1fr)` }}
        role="table"
        aria-describedby="board-caption"
        data-layout={stacked ? "stacked" : "table"}
      >
        {themes.map((theme) => (
          <BoardThemeRow
            key={theme.id}
            theme={theme}
            stacked={stacked}
            columns={columns}
            perRow={perRow}
            boardEdit={boardEdit}
          />
        ))}
      </div>
    </section>
  );
}
