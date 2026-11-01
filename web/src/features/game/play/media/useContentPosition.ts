import { useEffect, useState } from "react";
import { nextChangeAt, positionAt } from "@/game/contentPlan";
import type { ContentClock } from "@/game/reducer";
import { contentElapsed } from "@/game/questionPresentation";

/** Where the timeline is now, re-rendering exactly when the stage changes. */
export function useContentPosition(content: ContentClock, paused: boolean, replayEnabled = true) {
  const [, setTick] = useState(0);
  const [replay, setReplay] = useState<{
    plan: ContentClock["plan"];
    kind: ContentClock["kind"];
    offsetMs: number;
    attempt: number;
  } | null>(null);
  const clockAvailable = content.frozenAtMs == null && content.timer != null && replayEnabled;
  // A new plan (including a reconnect snapshot) or an answer freeze ends local replay.
  const retained = replay?.plan === content.plan && replay.kind === content.kind && clockAvailable;
  if (replay && !retained) setReplay(null);
  const offsetMs = retained ? replay.offsetMs : 0;
  const attempt = retained ? replay.attempt : 0;
  const now = () => Math.max(0, contentElapsed(content, paused) - offsetMs);
  const elapsed = now();
  const position = positionAt(content.plan, elapsed);
  const finished = position.done && position.background.length === 0;
  const running = clockAvailable && !paused;
  const next = running ? nextChangeAt(content.plan, elapsed) : null;

  useEffect(() => {
    if (next == null) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, next - elapsed) + 30);
    return () => window.clearTimeout(id);
  }, [next, elapsed]);

  function restart() {
    if (paused || !clockAvailable || !finished) return;
    setReplay({
      plan: content.plan,
      kind: content.kind,
      offsetMs: contentElapsed(content, false),
      attempt: attempt + 1,
    });
  }

  return {
    position,
    running,
    now,
    attempt,
    restart,
    finished,
    canRestart: clockAvailable && !paused,
  };
}
