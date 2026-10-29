import { useEffect, useState } from "react";
import { nextChangeAt, timerElapsed } from "@/game/contentPlan";
import type { GameSession } from "@/game/reducer";
import { phaseOf } from "@/game/selectors";

/** Refresh when the next content or buzzer boundary passes naturally. */
export function usePlaytestWait(session: GameSession): boolean {
  const [, setTick] = useState(0);
  const timer = session.state.timer;
  const paused = session.state.isPaused;
  const showing = phaseOf(session) === "showing";
  const elapsed = timerElapsed(timer, paused);
  const content = session.content;
  const step = showing && content?.kind === "question" ? nextChangeAt(content.plan, elapsed) : null;
  const opens =
    showing && (session.state.buzzerOpensAtMs ?? 0) > elapsed
      ? session.state.buzzerOpensAtMs
      : null;
  const next = step == null ? opens : opens == null ? step : Math.min(step, opens);
  useEffect(() => {
    if (!timer || paused || next == null) return;
    const id = window.setTimeout(
      () => setTick((tick) => tick + 1),
      Math.max(0, next - timerElapsed(timer, false)) + 30,
    );
    return () => window.clearTimeout(id);
  }, [timer, paused, next]);
  return !!timer && !paused && next != null;
}
