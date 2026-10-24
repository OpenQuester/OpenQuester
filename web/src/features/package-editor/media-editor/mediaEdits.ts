export const imageTools = ["select", "crop", "pen", "arrow", "rectangle", "text", "blur"] as const;
export type ImageTool = (typeof imageTools)[number];
export type ImagePoint = { x: number; y: number };
export type ImageCrop = { x: number; y: number; width: number; height: number };
export const fullImage: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };
export type DrawingTool = "pen" | "arrow" | "rectangle" | "text" | "blur";
export type ImageAnnotation = {
  id: string;
  tool: DrawingTool;
  points: ImagePoint[];
  color: string;
  size: number;
  text: string;
};

export interface ImageEdits {
  kind: "image";
  rotation: number;
  crop: ImageCrop | null;
  blur: number;
  quality: "small" | "balanced" | "high";
  /** Choosing even the default quality is an explicit request to re-encode. */
  qualityChanged: boolean;
  annotations: ImageAnnotation[];
}

export interface AudioVideoEdits {
  kind: "audio" | "video";
  start: number;
  end: number;
  mute: boolean;
  fadeIn: number;
  fadeOut: number;
}

export const initialImageEdits = (): ImageEdits => ({
  kind: "image",
  rotation: 0,
  crop: null,
  blur: 0,
  quality: "balanced",
  qualityChanged: false,
  annotations: [],
});
export const imageChanged = (e: ImageEdits) =>
  e.rotation % 360 !== 0 ||
  !!e.crop ||
  e.blur !== 0 ||
  e.qualityChanged ||
  e.annotations.length > 0;

export function fadeGain(time: number, duration: number, fadeIn: number, fadeOut: number) {
  return Math.max(
    0,
    Math.min(1, fadeIn > 0 ? time / fadeIn : 1, fadeOut > 0 ? (duration - time) / fadeOut : 1),
  );
}

export function validTrim(e: AudioVideoEdits, duration: number) {
  return (
    [e.start, e.end, e.fadeIn, e.fadeOut].every(Number.isFinite) &&
    e.start >= 0 &&
    e.end <= duration &&
    e.end > e.start &&
    e.fadeIn >= 0 &&
    e.fadeOut >= 0 &&
    e.fadeIn + e.fadeOut <= e.end - e.start + 1e-9
  );
}

/** The fade being edited wins; shortening a trim preserves the two fades' proportions. */
export function updateAudioVideoEdits(
  edits: AudioVideoEdits,
  patch: Partial<AudioVideoEdits>,
): AudioVideoEdits {
  const next = { ...edits, ...patch };
  const duration = Math.max(0, next.end - next.start);
  if (!Number.isFinite(duration)) return next;
  for (const key of ["fadeIn", "fadeOut"] as const) {
    if (patch[key] !== undefined) {
      next[key] = Math.max(0, Math.min(next[key], duration));
      const other = key === "fadeIn" ? "fadeOut" : "fadeIn";
      next[other] = Math.min(next[other], duration - next[key]);
    }
  }
  const total = next.fadeIn + next.fadeOut;
  if (total > duration) {
    next.fadeIn *= duration / total;
    next.fadeOut = duration - next.fadeIn;
  }
  return next;
}

/** A cut sets one boundary. Refuse empty/reversed intervals and no-op history entries. */
export function trimAtPlayhead(
  edits: AudioVideoEdits,
  edge: "start" | "end",
  position: number,
  duration: number,
) {
  const next = updateAudioVideoEdits(edits, { [edge]: position });
  return edits[edge] === position || !validTrim(next, duration) ? null : next;
}

export function formatTime(value: number) {
  if (!Number.isFinite(value)) return "";
  const ticks = Math.round(value * 100);
  return `${Math.floor(ticks / 6000)}:${((ticks % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}

export function parseTime(value: string) {
  const match = /^(\d+):([0-5]\d)(?:[.,](\d{1,3}))?$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? 0}`) : NaN;
}

export function rotationBounds(width: number, height: number, rotation: number) {
  const angle = ((rotation % 360) * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  return {
    width: Math.abs(width * cos) + Math.abs(height * sin),
    height: Math.abs(width * sin) + Math.abs(height * cos),
    cos,
    sin,
  };
}

/** Coordinates stay relative to the unrotated crop, including during selection/movement. */
export function unrotate(p: ImagePoint, rotation: number, width = 1, height = 1): ImagePoint {
  const bounds = rotationBounds(width, height, rotation);
  const x = (p.x - 0.5) * bounds.width,
    y = (p.y - 0.5) * bounds.height;
  return {
    x: (x * bounds.cos + y * bounds.sin) / width + 0.5,
    y: (-x * bounds.sin + y * bounds.cos) / height + 0.5,
  };
}

export function annotationBounds(a: ImageAnnotation) {
  const xs = a.points.map((p) => p.x),
    ys = a.points.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x + (a.tool === "text" ? (a.text.length * a.size) / 1600 : 0),
    height: Math.max(...ys) - y + (a.tool === "text" ? a.size / 800 : 0),
  };
}
