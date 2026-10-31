import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { allPlayReveal, findPlayer } from "@/game/selectors";
import type { AnsweredPlayer } from "@/game/protocol";
import { formatSigned } from "@/lib/format";
import { useSession } from "../../GameContext";
import { PlayerMessage, PlayerName } from "../PlayerName";
import { allPlayRevealText } from "../allPlayRevealText";

/** Result colours use the actual award, including showman overrides and multipliers. */
export function RevealResult({ result }: { result: AnsweredPlayer | null }) {
  const { t } = useTranslation();
  const session = useSession();
  const all = allPlayReveal(session);
  if (all?.correct.length)
    return (
      <>
        {t("reveal.correctPlayers", { players: "" })}{" "}
        {all.correct.map((entry, index) => (
          <Fragment key={entry.playerId}>
            {index > 0 && ", "}
            <PlayerName>
              {findPlayer(session, entry.playerId)?.meta.username ??
                t("reveal.playerFallback", { id: entry.playerId })}
            </PlayerName>
            {entry.scoreChange != null && (
              <span className="font-mono font-semibold text-success">
                {" "}
                ({formatSigned(entry.scoreChange)})
              </span>
            )}
          </Fragment>
        ))}
        {all.unresolved && <span className="text-warning"> {t("reveal.unresolved")}</span>}
      </>
    );
  if (!all && result?.answerType === "correct")
    return (
      <PlayerMessage
        i18nKey="reveal.gotIt"
        name={findPlayer(session, result.player)?.meta.username ?? t("roles.player")}
        values={{ points: formatSigned(result.result) }}
      />
    );
  return (
    <span className="text-warning">{allPlayRevealText(session, t) ?? t("reveal.nobody")}</span>
  );
}
