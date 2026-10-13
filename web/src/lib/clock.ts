/**
 * Estimated offset between the server clock and this device, in ms
 * (server = local + offset). Timers from the server carry server timestamps,
 * so a phone with a wrong clock would otherwise show the wrong countdown.
 */
let offsetMs = 0;
let samples = 0;

export function recordServerDate(
  dateHeader: string | null,
  sentAt: number,
  receivedAt: number,
): void {
  if (!dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  // The Date header has 1 s resolution; compare it against the request midpoint.
  const local = (sentAt + receivedAt) / 2;
  const sample = server + 500 - local;
  // Ignore sub-second noise: only correct clocks that are clearly off.
  const next = Math.abs(sample) < 1500 ? 0 : sample;
  samples += 1;
  offsetMs = samples === 1 ? next : offsetMs * 0.7 + next * 0.3;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function resetClock(): void {
  offsetMs = 0;
  samples = 0;
}
