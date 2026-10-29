import { useMemo } from "react";

import { buildContentPlan } from "@/game/contentPlan";
import type { GameSession, ContentClock } from "@/game/reducer";
import { useContentPosition } from "./media/useContentPosition";

const EMPTY_PLAN = { steps: [{ startMs: 0, durationMs: 0, items: [] }], totalMs: 0 };

/** Final-round content shares the final timer, including pause and rejoin. */
export function useFinalContent(session: GameSession, enabled = true) {
  const data = enabled ? session.state.finalRoundData?.questionData : null;
  const plan = useMemo(() => {
    if (!data) return null;
    if (data.contentPlan !== undefined) return data.contentPlan;
    const q = data.question;
    return q.textItems == null
      ? null
      : buildContentPlan({
          text: q.text,
          textOrder: q.textOrder,
          textItems: q.textItems,
          files: q.questionFiles,
        });
  }, [data]);
  const clock: ContentClock = {
    kind: "question",
    plan: plan ?? EMPTY_PLAN,
    timer: plan ? session.state.timer : null,
    // A reconnect can briefly have a plan but no timer. Keep the first step
    // until the server restores the clock instead of exposing a later step.
    frozenAtMs: plan && !session.state.timer ? 0 : null,
  };
  const { position } = useContentPosition(clock, session.state.isPaused);
  return { content: plan ? clock : null, playing: !!plan && !position.done };
}
