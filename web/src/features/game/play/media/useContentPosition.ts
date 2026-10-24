import { useEffect, useRef, useState } from "react";
import { nextChangeAt, positionAt, timerElapsed } from "@/game/contentPlan";
import type { ContentClock } from "@/game/reducer";
import { serverNow } from "@/lib/clock";

/** Where the timeline is now, re-rendering exactly when the stage changes. */
export function useContentPosition(content: ContentClock, paused: boolean) {
  const [, setTick] = useState(0);
  const running = content.frozenAtMs == null && content.timer != null && !paused;
  const elapsed =
    content.frozenAtMs ??
    (content.timer ? timerElapsed(content.timer, paused) : content.plan.totalMs);
  const position = positionAt(content.plan, elapsed);
  const next = running ? nextChangeAt(content.plan, elapsed) : null;

  useEffect(() => {
    if (next == null) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, next - elapsed) + 30);
    return () => window.clearTimeout(id);
  }, [next, elapsed]);

  // Read live when a clip (re)starts, so it seeks to where everyone else is.
  const clockRef = useRef({ content, paused });
  useEffect(() => {
    clockRef.current = { content, paused };
  });
  const now = () => {
    const c = clockRef.current;
    return (
      c.content.frozenAtMs ??
      (c.content.timer
        ? timerElapsed(c.content.timer, c.paused, serverNow())
        : c.content.plan.totalMs)
    );
  };

  return { position, running, now };
}
