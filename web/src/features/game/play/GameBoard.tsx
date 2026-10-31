import { gameBoardStyles } from "./board/gameBoardStyles";
import { useTranslation } from "react-i18next";
import { findPlayer, myRole } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { useGame, useGameState, useSession } from "../GameContext";
import { BoardThemeRow } from "./board/BoardThemeRow";
import { useBoardLayout } from "./board/useBoardLayout";
import type { CSSProperties } from "react";

/** The round board. Cells you can pick now are amber; played cells are empty. */
export function GameBoard() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const boardEdit = useGameState((s) => s.boardEdit);
  const setBoardEdit = useGameState((s) => s.setBoardEdit);
  const themes = [...(session.state.currentRound?.themes ?? [])].sort((a, b) => a.order - b.order);
  const picker = findPlayer(session, session.state.currentTurnPlayerId);
  const { ref, columns, stacked, perRow } = useBoardLayout(themes);

  return (
    <section
      aria-labelledby="board-caption"
      className="game-board flex min-h-0 flex-1 flex-col gap-3"
    >
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
        className="board-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-layout={stacked ? "stacked" : "table"}
      >
        <table className="block w-full" aria-labelledby="board-caption">
          <tbody
            className="board-rows"
            style={{ "--board-rows": Math.max(1, Math.min(9, themes.length)) } as CSSProperties}
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
