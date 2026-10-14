import { useEffect, useState } from "react";

import type { GameSession } from "@/game/reducer";
import { buzzerLockLeft, buzzerOpensIn } from "@/game/selectors";

export interface BuzzerTiming {
  /** The buzzer has opened: a press now is not a false start. */
  open: boolean;
  /** Milliseconds until it opens. */
  opensInMs: number;
  /** Milliseconds left on my false-start lock. */
  lockLeftMs: number;
}

/**
 * Buzzer timing for the current question, re-rendered while the buzzer is
 * still closed or I'm locked out, so the button flips the moment it opens.
 */
export function useBuzzer(session: GameSession, myId: number): BuzzerTiming {
  const [, setTick] = useState(0);
  const opensInMs = buzzerOpensIn(session);
  const lockLeftMs = buzzerLockLeft(session, myId);
  const waiting = opensInMs > 0 || lockLeftMs > 0;

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [waiting]);

  return { open: opensInMs <= 0, opensInMs, lockLeftMs };
}
