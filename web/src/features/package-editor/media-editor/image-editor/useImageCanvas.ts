import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  annotationBounds,
  initialImageEdits,
  fullImage,
  type ImageAnnotation,
  type ImageCrop,
  type ImageEdits,
} from "../mediaEdits";
import { renderImage, transformImage } from "../renderImage";
import type { EncodedImagePreview } from "./useImagePreview";
import type { ImageTool } from "../mediaEdits";

/** Keep canvas rendering and viewport measurement synchronized with the accepted edits. */
export function useImageCanvas({
  bitmap,
  edits,
  compare,
  preview,
  selectedAnnotation,
  cropDraft,
  tool,
  supported,
  setError,
}: {
  bitmap: ImageBitmap | null;
  edits: ImageEdits;
  compare: boolean;
  preview: EncodedImagePreview | null;
  selectedAnnotation: ImageAnnotation | undefined;
  cropDraft: ImageCrop | null;
  tool: ImageTool;
  supported: boolean;
  setError: Dispatch<SetStateAction<boolean>>;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [supported]);

  useEffect(() => {
    if (!bitmap || !canvas.current) return;
    const el = canvas.current;
    let alive = true;
    const visible = compare ? initialImageEdits() : edits;
    renderImage(el, bitmap, visible);
    const outline = () => {
      if (compare || (!selectedAnnotation && tool !== "crop")) return;
      const ctx = el.getContext("2d")!;
      const crop = edits.crop ?? fullImage;
      const w = bitmap.width;
      const h = bitmap.height;
      const box = tool === "crop" ? (cropDraft ?? crop) : annotationBounds(selectedAnnotation!);
      ctx.save();
      const scale = transformImage(ctx, bitmap, edits);
      ctx.strokeStyle = getComputedStyle(el).color;
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      if (tool === "crop") {
        ctx.fillStyle = getComputedStyle(el).color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.rect(box.x * w, box.y * h, box.width * w, box.height * h);
        ctx.fill("evenodd");
        ctx.globalAlpha = 1;
      }
      ctx.strokeRect(box.x * w, box.y * h, box.width * w, box.height * h);
      ctx.restore();
    };
    outline();
    if (!compare && preview?.edits === edits) {
      createImageBitmap(
        new Blob([preview.file.bytes as BlobPart], {
          type: `image/${preview.file.name.endsWith("avif") ? "avif" : "webp"}`,
        }),
      )
        .then((encoded) => {
          if (alive) {
            const ctx = el.getContext("2d")!;
            ctx.clearRect(0, 0, el.width, el.height);
            ctx.drawImage(encoded, 0, 0);
            outline();
          }
          encoded.close();
        })
        .catch(() => {
          if (alive) setError(true);
        });
    }
    return () => {
      alive = false;
    };
  }, [bitmap, edits, compare, preview, selectedAnnotation, cropDraft, tool, setError]);

  return { viewport, canvas, viewportSize };
}
