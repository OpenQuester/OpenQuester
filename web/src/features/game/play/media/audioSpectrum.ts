export const FFT_SIZE = 4096;
export const BAND_COUNT = 48;
export const BAND_BASELINE = 0.04;

export function spectrumBands(sampleRate: number) {
  const high = Math.min(16_000, sampleRate / 2);
  const binAt = (edge: number) =>
    Math.floor((40 * (high / 40) ** (edge / BAND_COUNT) * FFT_SIZE) / sampleRate);
  return Array.from({ length: BAND_COUNT }, (_, i) => {
    const start = binAt(i);
    return { start, end: Math.max(start + 1, binAt(i + 1)) };
  });
}

export function bandLevel(frequencies: Uint8Array, { start, end }: { start: number; end: number }) {
  let peak = 0;
  for (let bin = start; bin < end; bin++) peak = Math.max(peak, frequencies[bin]!);
  return Math.max(BAND_BASELINE, (peak / 255) ** 0.85);
}
