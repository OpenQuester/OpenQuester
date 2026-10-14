import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/settings/settingsStore";
import { buzzerLockLeft, canBuzz, findPlayer, myRole, phaseOf, type Phase } from "@/game/selectors";
import { formatSigned } from "@/lib/format";
import { playCue } from "@/lib/sound";

import { useGame, useSession } from "../GameContext";
import { useBuzzer } from "./useBuzzer";

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
  const buzzer = useBuzzer(session, myId);
  const prev = useRef<{
    phase: Phase;
    turn: number | null | undefined;
    result: number | null;
    open: boolean;
    locked: boolean;
  }>({
    phase: phaseOf(session),
    turn: session.state.currentTurnPlayerId,
    result: session.lastResult?.key ?? null,
    open: buzzer.open,
    locked: buzzer.lockLeftMs > 0,
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
      if (
        phase === "showing" &&
        buzzer.open &&
        myRole(session, myId) === "player" &&
        canBuzz(session, myId).ok
      )
        cue("open");
      if (phase === "answering" && session.state.answeringPlayer === myId) cue("buzz");
    } else if (
      phase === "showing" &&
      buzzer.open &&
      !before.open &&
      myRole(session, myId) === "player" &&
      canBuzz(session, myId).ok
    ) {
      // The content finished playing: the buzzer just opened.
      setText(t("dock.showing.open"));
      cue("open");
    }
    const locked = buzzerLockLeft(session, myId) > 0;
    if (locked && !before.locked) {
      setText(t("reasons.false_start"));
      cue("wrong");
    }
    if (
      turn !== before.turn &&
      turn === myId &&
      (phase === "choosing" || phase === "final_elimination")
    ) {
      setText(t("announce.yourTurn"));
      cue("turn");
    }
    prev.current = { phase, turn, result: last?.key ?? null, open: buzzer.open, locked };
  }, [session, myId, sound, volume, t, buzzer.open]);

  return text;
}
