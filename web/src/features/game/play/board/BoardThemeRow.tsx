import { gameBoardStyles } from "./gameBoardStyles";
import { useTranslation } from "react-i18next";
import type { BoardTheme, BoardQuestion } from "@/game/protocol";
import { canPick, myRole } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { useGame, useSession } from "../../GameContext";
import { ExpandableText } from "@/ui/ExpandableText";
import type { CSSProperties } from "react";

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
    <tr
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
      <th
        scope="row"
        className={cn(
          gameBoardStyles.theme,
          stacked ? gameBoardStyles.compactThemeName : gameBoardStyles.themeSize,
        )}
      >
        <ExpandableText text={theme.name} className="w-full" />
      </th>
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
        Array.from({ length: columns - theme.questions.length }, (_, i) => <td key={`pad-${i}`} />)}
    </tr>
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
  const label = t(q.isPlayed ? "board.played" : "board.cell", {
    theme: themeName,
    price: q.price ?? "?",
  });
  const price = q.price != null ? formatScore(q.price) : "?";
  const appearance = q.isPlayed
    ? gameBoardStyles.playedQuestion
    : can.ok
      ? gameBoardStyles.availableQuestion
      : "cursor-default border border-line-strong bg-surface-2 text-soft";
  return (
    <td className="flex p-0">
      <button
        type="button"
        aria-label={label}
        disabled={!can.ok || (!editing && q.isPlayed)}
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
          appearance,
        )}
      >
        <span className="board-price" style={{ "--price-length": price.length } as CSSProperties}>
          {price}
        </span>
      </button>
    </td>
  );
}
