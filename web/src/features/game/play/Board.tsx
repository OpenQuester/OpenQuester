import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { canPick, findPlayer } from "@/game/selectors";
import { formatScore } from "@/lib/format";

import { useGame, useSession } from "../GameContext";

/** The round board. Cells you can pick now are amber; played cells are empty. */
export function Board() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const themes = [...(session.state.currentRound?.themes ?? [])].sort((a, b) => a.order - b.order);
  const columns = Math.max(1, ...themes.map((th) => th.questions.length));
  const picker = findPlayer(session, session.state.currentTurnPlayerId);
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  // A theme name column plus one column per price only works while every cell
  // keeps a usable width. Otherwise each theme gets its own block: the name on
  // top, prices wrapping underneath.
  const stacked = width > 0 && (width < 560 || (width - 220) / columns < 64);
  // In stacked mode, spread prices evenly over rows (10 → 5 + 5, not 9 + 1).
  const perRowMax = Math.max(1, Math.floor((width - 16 + 8) / (58 + 8)));
  const rows = Math.ceil(columns / perRowMax);
  const perRow = Math.ceil(columns / rows);

  return (
    <section aria-labelledby="board-caption" className="flex flex-1 flex-col gap-3">
      <h2 id="board-caption" className="sr-only">
        {t("board.caption", { round: session.state.currentRound?.name ?? "" })}
        {picker ? `. ${t("board.picker", { name: picker.meta.username })}` : ""}
      </h2>
      <div
        ref={ref}
        className="grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: `minmax(0, 1fr)` }}
        role="table"
        aria-describedby="board-caption"
        data-layout={stacked ? "stacked" : "table"}
      >
        {themes.map((theme) => (
          <div
            key={theme.id}
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
                "flex items-center rounded-md bg-surface font-semibold leading-tight [overflow-wrap:anywhere]",
                stacked
                  ? "col-span-full px-1.5 pb-0.5 pt-1 text-[15px]"
                  : "min-h-14 px-3 py-2 text-[15px] sm:min-h-16 sm:px-4 sm:text-base lg:min-h-20 lg:text-lg 3xl:min-h-24 3xl:text-xl 4xl:min-h-28 4xl:text-2xl",
              )}
            >
              {theme.name}
            </div>
            {[...theme.questions]
              .sort((a, b) => a.order - b.order)
              .map((q) => {
                const can = canPick(session, myId, q);
                const label = q.isPlayed
                  ? t("board.played", { theme: theme.name, price: q.price ?? "?" })
                  : t("board.cell", { theme: theme.name, price: q.price ?? "?" });
                return (
                  <div role="cell" key={q.id} className="flex">
                    <button
                      type="button"
                      aria-label={label}
                      disabled={q.isPlayed || !can.ok}
                      onClick={() => connection.emit("question-pick", { questionId: q.id })}
                      data-testid="board-cell"
                      data-question-id={q.id}
                      className={cn(
                        "flex w-full items-center justify-center rounded-md font-mono font-bold",
                        stacked
                          ? "min-h-12 text-base"
                          : "min-h-14 text-lg sm:min-h-16 sm:text-2xl lg:min-h-20 lg:text-3xl 3xl:min-h-24 3xl:text-4xl 4xl:min-h-28 4xl:text-5xl",
                        q.isPlayed &&
                          "border border-line bg-transparent text-ghost line-through opacity-60",
                        !q.isPlayed &&
                          can.ok &&
                          "border border-accent-line bg-surface-3 text-accent-strong hover:bg-accent-surface hover:border-accent",
                        !q.isPlayed &&
                          !can.ok &&
                          "cursor-default border border-line-strong bg-surface-2 text-soft",
                      )}
                    >
                      {q.price != null ? formatScore(q.price) : "?"}
                    </button>
                  </div>
                );
              })}
            {!stacked &&
              Array.from({ length: columns - theme.questions.length }, (_, i) => (
                <div key={`pad-${i}`} role="cell" />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
