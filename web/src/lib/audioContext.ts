let context: AudioContext | undefined;
const changes = new EventTarget();

export function getAudioContext() {
  return context;
}

export function watchAudioContext(sync: () => void) {
  changes.addEventListener("change", sync);
  return () => changes.removeEventListener("change", sync);
}

/** Call from a user gesture to unlock audio even when game cues are disabled. */
export function resumeAudioContext() {
  try {
    if (!context) {
      context = new AudioContext();
      const notify = () => changes.dispatchEvent(new Event("change"));
      context.addEventListener("statechange", notify);
      notify();
    }
    if (context.state !== "running") void context.resume().catch(() => undefined);
    return context;
  } catch {
    // Native media can still play if Web Audio is unavailable.
    return undefined;
  }
}
