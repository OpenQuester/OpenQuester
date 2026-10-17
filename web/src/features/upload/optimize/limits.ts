/**
 * Targets shared by every encoder, matching the Flutter desktop encoder
 * (client/packages/oq_compress/lib/src/common/command_wrapper.dart):
 * pictures and video fit in 1280×720, video runs at most 20 fps, sound is
 * Opus at 64 kbps (or AAC at 96 kbps, see av.ts).
 */
export const MAX_WIDTH = 1280;
export const MAX_HEIGHT = 720;
export const MAX_FPS = 20;
export const OPUS_BITRATE = 64_000;
/** AAC needs a bit more than Opus for the same quality. */
export const AAC_BITRATE = 96_000;
/** VP9 budget: about 650 kbps at 1280×720 and 20 fps. */
export const VP9_BITS_PER_PIXEL = 0.035;

/** A result is kept only when it saves at least this share of the original. */
export const MIN_SAVING = 0.05;

/** Size that fits the box without upscaling, rounded to even numbers for the video encoders. */
export function fitBox(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(width * scale), height: even(height * scale) };
}
