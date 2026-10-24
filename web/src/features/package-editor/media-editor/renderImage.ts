import { MAX_HEIGHT, MAX_WIDTH } from "@/features/upload/optimize/limits";
import {
  fullImage,
  rotationBounds,
  type ImageAnnotation,
  type ImageCrop,
  type ImageEdits,
} from "./mediaEdits";

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function imageSize(
  width: number,
  height: number,
  rotation: number,
  crop: ImageCrop | null = null,
) {
  ({ width, height } = rotationBounds(
    width * (crop?.width ?? 1),
    height * (crop?.height ?? 1),
    rotation,
  ));
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Use the same source transform for pixels and selection outlines. */
export function transformImage(
  ctx: Context,
  bitmap: { width: number; height: number },
  edits: ImageEdits,
) {
  const crop = edits.crop ?? fullImage;
  const bounds = rotationBounds(
    bitmap.width * crop.width,
    bitmap.height * crop.height,
    edits.rotation,
  );
  const size = imageSize(bitmap.width, bitmap.height, edits.rotation, crop);
  ctx.translate(size.width / 2, size.height / 2);
  ctx.scale(size.width / bounds.width, size.height / bounds.height);
  ctx.rotate(((edits.rotation % 360) * Math.PI) / 180);
  ctx.translate(
    -bitmap.width * (crop.x + crop.width / 2),
    -bitmap.height * (crop.y + crop.height / 2),
  );
  return Math.min(size.width / bounds.width, size.height / bounds.height);
}

/** Shared by the immediate canvas preview and the encoding worker. */
export function renderImage(canvas: Canvas, bitmap: ImageBitmap, edits: ImageEdits) {
  const size = imageSize(bitmap.width, bitmap.height, edits.rotation, edits.crop);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d") as Context;
  const crop = edits.crop ?? fullImage;
  const w = bitmap.width;
  const h = bitmap.height;
  ctx.save();
  const scale = transformImage(ctx, bitmap, edits);
  ctx.beginPath();
  ctx.rect(crop.x * w, crop.y * h, crop.width * w, crop.height * h);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  const blur = (amount: number) => {
    if (amount > 0 && !("filter" in ctx)) throw new Error("unsupported");
    ctx.filter = amount > 0 ? `blur(${(amount * Math.max(w, h) * scale) / 1000}px)` : "none";
  };
  blur(edits.blur);
  ctx.drawImage(bitmap, 0, 0, w, h);
  for (const a of edits.annotations.filter((a) => a.tool === "blur")) {
    const p = a.points[0]!,
      q = a.points[a.points.length - 1]!;
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      Math.min(p.x, q.x) * w,
      Math.min(p.y, q.y) * h,
      Math.abs(q.x - p.x) * w,
      Math.abs(q.y - p.y) * h,
    );
    ctx.clip();
    // Replace the clipped pixels: source-over would leave sharp translucent pixels under the blur.
    ctx.clearRect(0, 0, w, h);
    blur(Math.max(edits.blur, a.size));
    ctx.drawImage(bitmap, 0, 0, w, h);
    ctx.restore();
  }
  ctx.filter = "none";
  for (const a of edits.annotations.filter((a) => a.tool !== "blur")) drawAnnotation(ctx, a, w, h);
  ctx.restore();
  return size;
}

function drawAnnotation(ctx: Context, a: ImageAnnotation, w: number, h: number) {
  const p = a.points[0]!,
    q = a.points[a.points.length - 1]!;
  const size = (a.size * Math.max(w, h)) / 1000;
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (a.tool === "text") {
    ctx.font = `${size}px sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(a.text, p.x * w, p.y * h);
    return;
  }
  ctx.beginPath();
  if (a.tool === "rectangle") ctx.rect(p.x * w, p.y * h, (q.x - p.x) * w, (q.y - p.y) * h);
  else {
    ctx.moveTo(p.x * w, p.y * h);
    for (const point of a.points.slice(1)) ctx.lineTo(point.x * w, point.y * h);
    if (a.tool === "arrow") {
      const angle = Math.atan2((q.y - p.y) * h, (q.x - p.x) * w);
      for (const delta of [-0.5, 0.5]) {
        ctx.moveTo(q.x * w, q.y * h);
        ctx.lineTo(
          q.x * w - Math.cos(angle + delta) * size * 4,
          q.y * h - Math.sin(angle + delta) * size * 4,
        );
      }
    }
  }
  ctx.stroke();
}
