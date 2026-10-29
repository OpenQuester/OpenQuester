import { allPlayReveal, findPlayer } from "@/game/selectors";
import type { GameSession } from "@/game/reducer";
import { formatSigned } from "@/lib/format";
import type { TranslateAction } from "./dock/actionDockModel";

/** The stage and dock describe the same authoritative all-play results. */
export function allPlayRevealText(session: GameSession, t: TranslateAction): string | null {
  const result = allPlayReveal(session);
  if (!result) return null;
  if (!result.correct.length) {
    if (result.unresolved) return t("reveal.unresolved");
    return t(result.submitted ? "reveal.nobody" : "reveal.noSubmissions");
  }
  const players = result.correct.map((entry) => {
    const name =
      findPlayer(session, entry.playerId)?.meta.username ??
      t("reveal.playerFallback", { id: entry.playerId });
    return entry.scoreChange == null ? name : `${name} (${formatSigned(entry.scoreChange)})`;
  });
  const summary = t("reveal.correctPlayers", { players: players.join(", ") });
  return result.unresolved ? `${summary} ${t("reveal.unresolved")}` : summary;
}
