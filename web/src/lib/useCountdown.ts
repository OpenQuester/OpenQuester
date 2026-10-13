import { useEffect, useState } from "react";

import { remainingMs, type TimerLike } from "./timer";

/** Re-renders a few times a second while a timer runs. */
export function useCountdown(timer: TimerLike | null | undefined, paused = false) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer || paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer, paused]);
  void now;
  const left = remainingMs(timer, paused);
  const total = timer ? timer.durationMs : null;
  return { left, total, fraction: left != null && total ? left / total : null };
}
