import { useEffect, useState } from "react";
import { nextChangeAt, positionAt } from "@/game/contentPlan";
import type { ContentClock } from "@/game/reducer";
import { contentElapsed } from "@/game/questionPresentation";
import { timerStartDelay } from "@/lib/timer";

type LocalReplay = Pick<ContentClock, "kind" | "plan"> & {
  start: number;
  generation: number;
  fullStart?: number;
  attempt: number;
  file?: { id: string; duration: number };
};

/** Follow the phase clock, with separate local starts for full and per-file replays. */
export function useContentPosition(content: ContentClock, paused: boolean, replayEnabled = true) {
  const [, setTick] = useState(0);
  const [replay, setReplay] = useState<LocalReplay | null>(null);
  const clockAvailable = content.frozenAtMs == null && content.timer != null && replayEnabled;
  const retained =
    replay?.plan === content.plan && replay.kind === content.kind && clockAvailable ? replay : null;
  if (replay && !retained) setReplay(null);
  const file = retained?.file;
  const clockNow = () => contentElapsed(content, paused);
  const now = () => Math.max(0, clockNow() - (retained?.fullStart ?? 0));
  const elapsed = now();
  const position = positionAt(content.plan, elapsed);
  const finished = position.done && position.background.length === 0;
  const startDelay = clockAvailable && !paused ? timerStartDelay(content.timer) : 0;
  const running = clockAvailable && !paused && startDelay === 0;
  const fileNow = () => Math.max(0, clockNow() - (retained?.start ?? 0));
  const fileElapsed = file ? fileNow() : 0;
  const next = !running
    ? null
    : file
      ? fileElapsed < file.duration
        ? file.duration
        : null
      : nextChangeAt(content.plan, elapsed);
  const delay = startDelay || (next == null ? null : next - (file ? fileElapsed : elapsed));

  useEffect(() => {
    if (delay == null) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.max(1, Math.ceil(delay)));
    return () => window.clearTimeout(id);
  }, [content.plan, delay, next]);

  function start(file?: LocalReplay["file"]) {
    if (!running || !finished) return;
    const start = clockNow();
    const generation = (retained?.generation ?? 0) + 1;
    setReplay({
      plan: content.plan,
      kind: content.kind,
      start,
      generation,
      fullStart: file ? retained?.fullStart : start,
      attempt: file ? (retained?.attempt ?? 0) : generation,
      file,
    });
  }

  return {
    position,
    running,
    now,
    attempt: retained?.attempt ?? 0,
    restart: () => start(),
    select: (id: string, duration: number) => start({ id, duration }),
    fileReplay:
      file && retained
        ? { id: file.id, elapsed: fileElapsed, now: fileNow, generation: retained.generation }
        : null,
    finished,
    canRestart: running,
  };
}
