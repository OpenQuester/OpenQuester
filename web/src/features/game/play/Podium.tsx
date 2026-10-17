import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { standings } from "@/game/selectors";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";

import { useGame, useSession } from "../GameContext";

export function Podium() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const ranked = standings(session);
  const top = ranked[0];
  const tie = ranked.length > 1 && ranked[1]!.score === top?.score;
  // Second, first, third — leaving out places nobody took.
  const podium = [
    { p: ranked[1], place: 2, height: "h-28" },
    { p: ranked[0], place: 1, height: "h-40" },
    { p: ranked[2], place: 3, height: "h-20" },
  ].filter((x) => x.p != null);

  return (
    <section
      className="mx-auto flex w-full max-w-[900px] flex-col items-center gap-8 oq-pop"
      aria-labelledby="podium-h"
      data-testid="podium"
    >
      <h2
        id="podium-h"
        className="m-0 text-center font-display text-[clamp(32px,6vw,52px)] font-extrabold"
      >
        {!top
          ? t("finished.noPlayers")
          : tie
            ? t("finished.tie")
            : t("finished.wins", { name: top.meta.username })}
      </h2>
      {ranked.length > 0 && (
        <ol
          className="m-0 flex w-full list-none items-end justify-center gap-3 p-0 sm:gap-5"
          aria-label={t("finished.podium")}
        >
          {podium.map(({ p, place, height }) =>
            p ? (
              <li
                key={p.meta.id}
                className="flex w-[30%] max-w-[200px] flex-col items-center gap-2"
              >
                <Avatar name={p.meta.username} src={p.meta.avatar} size={place === 1 ? 64 : 52} />
                <span className="max-w-full truncate text-center font-semibold">
                  {p.meta.username}
                  {p.meta.id === myId && <span className="text-muted"> ({t("common.you")})</span>}
                </span>
                <b className="font-mono text-lg">{formatScore(p.score)}</b>
                <div
                  className={cn(
                    "flex w-full items-start justify-center rounded-t-md pt-3 font-display text-3xl font-extrabold",
                    height,
                    place === 1 ? "bg-accent text-on-accent" : "bg-surface-3 text-soft",
                  )}
                  aria-label={t("finished.place", { n: place })}
                >
                  {place}
                </div>
              </li>
            ) : null,
          )}
        </ol>
      )}
      {ranked.length > 3 && (
        <ol start={4} className="m-0 flex w-full max-w-[520px] flex-col gap-2 p-0">
          {ranked.slice(3).map((p, i) => (
            <li
              key={p.meta.id}
              className="flex items-center gap-3 rounded-md bg-surface px-4 py-2.5"
            >
              <span className="w-6 font-mono text-muted">{i + 4}</span>
              <span className="flex-1">{p.meta.username}</span>
              <b className="font-mono">{formatScore(p.score)}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
