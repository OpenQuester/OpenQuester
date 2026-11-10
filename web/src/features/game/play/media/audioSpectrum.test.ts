import { expect, it } from "vitest";
import { BAND_BASELINE, BAND_COUNT, FFT_SIZE, bandLevel, spectrumBands } from "./audioSpectrum";

it("separates bass, mid and high peaks across 48 logarithmic bands", () => {
  const sampleRate = 48_000;
  const bands = spectrumBands(sampleRate);
  const frequencies = new Uint8Array(FFT_SIZE / 2);
  expect(bands).toHaveLength(BAND_COUNT);
  expect(bands.every((band) => bandLevel(frequencies, band) === BAND_BASELINE)).toBe(true);

  for (const [hz, first, last] of [
    [55, 0, 5],
    [1000, 24, 28],
    [12000, 44, 47],
  ] as const) {
    const bin = Math.floor((hz * FFT_SIZE) / sampleRate);
    frequencies[bin] = 64;
    const i = bands.findIndex((band) => bandLevel(frequencies, band) > BAND_BASELINE);
    expect(i).toBeGreaterThanOrEqual(first);
    expect(i).toBeLessThanOrEqual(last);
    expect(bandLevel(frequencies, bands[i]!)).toBeCloseTo((64 / 255) ** 0.85);
    frequencies[bin] = 255;
    expect(bandLevel(frequencies, bands[i]!)).toBe(1);
    frequencies[bin] = 0;
  }
});
