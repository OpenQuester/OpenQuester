import { fadeGain, type AudioVideoEdits } from "../mediaEdits";

export function timelineKeyPosition(
  key: string,
  shift: boolean,
  position: number,
  duration: number,
) {
  const step = shift ? 1 : 0.1;
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return duration;
    case "ArrowRight":
    case "ArrowUp":
      return position + step;
    case "ArrowLeft":
    case "ArrowDown":
      return position - step;
    case "PageUp":
      return position + 10;
    case "PageDown":
      return position - 10;
    default:
      return null;
  }
}

/** Display the same linear gain envelope used by playback and export. */
export function fadeEnvelopePoints(edits: AudioVideoEdits) {
  const duration = edits.end - edits.start;
  return [...new Set([0, edits.fadeIn, duration - edits.fadeOut, duration])]
    .sort((a, b) => a - b)
    .map(
      (at) =>
        `${edits.start + at},${90 - 80 * fadeGain(at, duration, edits.fadeIn, edits.fadeOut)}`,
    )
    .join(" ");
}
