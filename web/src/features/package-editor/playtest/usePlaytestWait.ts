import { useEffect, useState } from "react";
import { nextChangeAt, timerElapsed } from "@/game/contentPlan";
import type { GameSession } from "@/game/reducer";
import { phaseOf } from "@/game/selectors";
import {
  contentElapsed,
  presentedQuestionContent,
  type QuestionPresentation,
} from "@/game/questionPresentation";

/** Refresh when the next content or buzzer boundary passes naturally. */
export function usePlaytestWait(
  session: GameSession,
  presentation: QuestionPresentation | null = null,
): boolean {
  const [, setTick] = useState(0);
  const timer = session.state.timer;
  const paused = session.state.isPaused;
  const showing = phaseOf(session) === "showing";
  const elapsed = timerElapsed(timer, paused);
  const content = presentedQuestionContent(session, presentation);
  const localElapsed = content ? contentElapsed(content, paused) : elapsed;
  const localStep =
    showing && content?.kind === "question" ? nextChangeAt(content.plan, localElapsed) : null;
  const step = localStep == null ? null : elapsed + localStep - localElapsed;
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
