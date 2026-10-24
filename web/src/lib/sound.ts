let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export type Cue = "open" | "turn" | "correct" | "wrong" | "buzz";

const CUES: Record<Cue, [number, number][]> = {
  open: [
    [660, 0.09],
    [880, 0.12],
  ],
  turn: [
    [523, 0.08],
    [784, 0.14],
  ],
  correct: [
    [523, 0.08],
    [659, 0.08],
    [784, 0.16],
  ],
  wrong: [
    [300, 0.12],
    [220, 0.2],
  ],
  buzz: [[440, 0.08]],
};

/** Short synthesized cues; no audio files to download. */
export function playCue(cue: Cue, volume: number): void {
  const ac = audio();
  if (!ac || volume <= 0) return;
  let at = ac.currentTime;
  for (const [freq, dur] of CUES[cue]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.18 * volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    at += dur * 0.9;
  }
}
