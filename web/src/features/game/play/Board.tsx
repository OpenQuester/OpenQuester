import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { canPick, findPlayer } from "@/game/selectors";
import { formatScore } from "@/lib/format";

import { useGame, useSession } from "../GameContext";

/** The round board. Cells you can pick now are amber; played cells are empty. */
export function Board() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const themes = session.state.currentRound?.themes ?? [];
  const columns = Math.max(1, ...themes.map((th) => th.questions.length));
  const picker = findPlayer(session, session.state.currentTurnPlayerId);

  return (
    <section aria-labelledby="board-caption" className="flex flex-1 flex-col gap-3">
      <h2 id="board-caption" className="sr-only">
        {t("board.caption", { round: session.state.currentRound?.name ?? "" })}
        {picker ? `. ${t("board.picker", { name: picker.meta.username })}` : ""}
      </h2>
      <div
        className="grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: `minmax(0, 1fr)` }}
        role="table"
        aria-describedby="board-caption"
      >
        {themes.map((theme) => (
          <div
            key={theme.id}
            role="row"
            className="grid items-stretch gap-2 sm:gap-2.5"
            style={{
              gridTemplateColumns: `minmax(clamp(76px, 24vw, 240px), 1fr) repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            <div
              role="rowheader"
              className="flex min-h-14 items-center rounded-md bg-surface px-3 py-2 text-[15px] font-semibold leading-tight [overflow-wrap:anywhere] sm:min-h-16 sm:px-4 sm:text-base lg:min-h-20 lg:text-lg"
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
                        "flex min-h-14 w-full items-center justify-center rounded-md font-mono text-lg font-bold sm:min-h-16 sm:text-2xl lg:min-h-20 lg:text-3xl",
                        q.isPlayed && "border border-line bg-transparent text-transparent",
                        !q.isPlayed &&
                          can.ok &&
                          "border border-accent-line bg-surface-3 text-accent-strong hover:bg-accent-surface hover:border-accent",
                        !q.isPlayed &&
                          !can.ok &&
                          "cursor-default border border-line-strong bg-surface-2 text-soft",
                      )}
                    >
                      {q.isPlayed ? "" : q.price != null ? formatScore(q.price) : "?"}
                    </button>
                  </div>
                );
              })}
            {Array.from({ length: columns - theme.questions.length }, (_, i) => (
              <div key={`pad-${i}`} role="cell" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
