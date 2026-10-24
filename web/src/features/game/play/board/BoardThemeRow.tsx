import { gameBoardStyles } from "./gameBoardStyles";
import { useTranslation } from "react-i18next";
import type { BoardTheme, BoardQuestion } from "@/game/protocol";
import { canPick, myRole } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useGame, useSession } from "../../GameContext";

export function BoardThemeRow({
  theme,
  stacked,
  columns,
  perRow,
  boardEdit,
}: {
  theme: BoardTheme;
  stacked: boolean;
  columns: number;
  perRow: number;
  boardEdit: boolean;
}) {
  return (
    <div
      role="row"
      className={cn(
        "grid items-stretch gap-2 sm:gap-2.5",
        stacked && "rounded-md bg-surface p-2 sm:p-2.5",
      )}
      style={{
        gridTemplateColumns: stacked
          ? `repeat(${perRow}, minmax(0, 1fr))`
          : `minmax(clamp(76px, 24vw, 240px), 1fr) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      <div
        role="rowheader"
        className={cn(
          gameBoardStyles.theme,
          stacked ? gameBoardStyles.compactThemeName : gameBoardStyles.themeSize,
        )}
      >
        {theme.name}
      </div>
      {[...theme.questions]
        .sort((a, b) => a.order - b.order)
        .map((q) => (
          <BoardQuestionCell
            key={q.id}
            q={q}
            themeName={theme.name}
            stacked={stacked}
            boardEdit={boardEdit}
          />
        ))}
      {!stacked &&
        Array.from({ length: columns - theme.questions.length }, (_, i) => (
          <div key={`pad-${i}`} role="cell" />
        ))}
    </div>
  );
}

function BoardQuestionCell({
  q,
  themeName,
  stacked,
  boardEdit,
}: {
  q: BoardQuestion;
  themeName: string;
  stacked: boolean;
  boardEdit: boolean;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();

  // Showman board editing: any cell toggles between on and off the board
  const editing = boardEdit && myRole(session, myId) === "showman";
  const can = editing ? { ok: true as const } : canPick(session, myId, q);
  const label = q.isPlayed
    ? t("board.played", { theme: themeName, price: q.price ?? "?" })
    : t("board.cell", { theme: themeName, price: q.price ?? "?" });
  return (
    <div role="cell" className="flex">
      <button
        type="button"
        aria-label={label}
        disabled={editing ? false : q.isPlayed || !can.ok}
        onClick={() =>
          editing
            ? connection.emit("question-remove-restore", { questionId: q.id })
            : connection.emit("question-pick", { questionId: q.id })
        }
        data-editing={editing || undefined}
        data-testid="board-cell"
        data-question-id={q.id}
        className={cn(
          gameBoardStyles.question,
          stacked ? "min-h-12 text-base" : gameBoardStyles.questionSize,
          q.isPlayed && gameBoardStyles.playedQuestion,
          !q.isPlayed && can.ok && gameBoardStyles.availableQuestion,
          !q.isPlayed &&
            !can.ok &&
            "cursor-default border border-line-strong bg-surface-2 text-soft",
        )}
      >
        {q.price != null ? formatScore(q.price) : "?"}
      </button>
    </div>
  );
}
