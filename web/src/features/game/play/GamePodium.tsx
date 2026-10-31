import { stageStyles } from "./stages/stageStyles";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { standings } from "@/game/selectors";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { ExpandableText } from "@/ui/ExpandableText";

import { useGame, useSession } from "../GameContext";

export function GamePodium() {
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
    <section className={stageStyles.podium} aria-labelledby="podium-h" data-testid="podium">
      <h2 id="podium-h" className={stageStyles.podiumTitle}>
        {!top
          ? t("finished.noPlayers")
          : tie
            ? t("finished.tie")
            : t("finished.wins", { name: top.meta.username })}
      </h2>
      {ranked.length > 0 && (
        <ol className={stageStyles.podiumPlaces} aria-label={t("finished.podium")}>
          {podium.map(({ p, place, height }) =>
            p ? (
              <li key={p.meta.id} className={stageStyles.podiumPlayer}>
                <Avatar name={p.meta.username} src={p.meta.avatar} size={place === 1 ? 64 : 52} />
                <ExpandableText
                  text={`${p.meta.username}${p.meta.id === myId ? ` (${t("common.you")})` : ""}`}
                  className="text-center font-semibold"
                />
                <b className="podium-score font-mono">{formatScore(p.score)}</b>
                <div
                  className={cn(
                    stageStyles.podiumStep,
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
        <ol start={4} className={stageStyles.remainingPlaces}>
          {ranked.slice(3).map((p, i) => (
            <li key={p.meta.id} className={stageStyles.remainingPlayer}>
              <span className="w-6 shrink-0 font-mono text-muted">{i + 4}</span>
              <ExpandableText text={p.meta.username} className="flex-1" />
              <b className="shrink-0 whitespace-nowrap font-mono text-sm sm:text-base">
                {formatScore(p.score)}
              </b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
