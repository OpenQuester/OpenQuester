import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/settings/settingsStore";
import { canBuzz, findPlayer, myRole, phaseOf, type Phase } from "@/game/selectors";
import { formatSigned } from "@/lib/format";
import { playCue } from "@/lib/sound";

import { useGame, useSession } from "../GameContext";

/**
 * Sound cues and the screen-reader announcement for state changes: the phase,
 * your turn, and every judged answer.
 */
export function useGameFeedback(): string {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const sound = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);
  const [text, setText] = useState("");
  const prev = useRef<{ phase: Phase; turn: number | null | undefined; result: number | null }>({
    phase: phaseOf(session),
    turn: session.state.currentTurnPlayerId,
    result: session.lastResult?.key ?? null,
  });

  useEffect(() => {
    const phase = phaseOf(session);
    const turn = session.state.currentTurnPlayerId;
    const last = session.lastResult;
    const before = prev.current;
    const cue = (c: Parameters<typeof playCue>[0]) => sound && playCue(c, volume);

    if (last && last.key !== before.result) {
      const name = findPlayer(session, last.player)?.meta.username ?? "";
      setText(
        last.answerType === "correct"
          ? t("announce.correct", { name, points: formatSigned(last.result) })
          : t("announce.wrong", { name, points: formatSigned(last.result) }),
      );
      cue(last.answerType === "correct" ? "correct" : "wrong");
    } else if (phase !== before.phase) {
      setText(t(`phases.${phase}`));
      if (phase === "showing" && myRole(session, myId) === "player" && canBuzz(session, myId).ok)
        cue("open");
      if (phase === "answering" && session.state.answeringPlayer === myId) cue("buzz");
    }
    if (
      turn !== before.turn &&
      turn === myId &&
      (phase === "choosing" || phase === "final_elimination")
    ) {
      setText(t("announce.yourTurn"));
      cue("turn");
    }
    prev.current = { phase, turn, result: last?.key ?? null };
  }, [session, myId, sound, volume, t]);

  return text;
}
