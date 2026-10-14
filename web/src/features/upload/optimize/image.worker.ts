/// <reference lib="webworker" />
import encodeAvif from "@jsquash/avif/encode";

import { MAX_HEIGHT, MAX_WIDTH } from "./limits";

export interface ImageJob {
  id: number;
  bytes: Uint8Array;
  mime: string;
}

export type ImageResult =
  | { id: number; ok: true; bytes: Uint8Array; ext: "avif" | "webp" }
  | { id: number; ok: false; error: string };

/**
 * Decodes with the browser, scales into 1280×720 and encodes AVIF with the
 * libavif WebAssembly build. The encoder blocks while it works, hence the worker.
 */
self.onmessage = async ({ data }: MessageEvent<ImageJob>) => {
  try {
    const bitmap = await createImageBitmap(new Blob([data.bytes as BlobPart], { type: data.mime }));
    const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let result: ImageResult;
    try {
      const pixels = ctx.getImageData(0, 0, width, height);
      // Quality 50 at 4:2:0 is close to the Flutter encoder's crf 40.
      const avif = await encodeAvif(pixels, { quality: 50, speed: 6, subsample: 1 });
      result = { id: data.id, ok: true, bytes: new Uint8Array(avif), ext: "avif" };
    } catch {
      // No WebAssembly (or out of memory): WebP from the canvas is the next best.
      const webp = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
      if (webp.type !== "image/webp") throw new Error("no encoder");
      result = {
        id: data.id,
        ok: true,
        bytes: new Uint8Array(await webp.arrayBuffer()),
        ext: "webp",
      };
    }
    self.postMessage(result, [result.bytes.buffer]);
  } catch (err) {
    self.postMessage({ id: data.id, ok: false, error: String(err) } satisfies ImageResult);
  }
};
