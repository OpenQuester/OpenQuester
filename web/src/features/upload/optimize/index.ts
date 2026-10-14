import { md5Hex, mimeFor } from "../archive";
import type { MediaFile, ParsedPackage } from "../types";

import { encodeAv } from "./av";
import type { ImageJob, ImageResult } from "./image.worker";
import { MIN_SAVING } from "./limits";

export interface OptimizeProgress {
  /** Files finished, of those that can be re-encoded. */
  done: number;
  total: number;
  /** 0–1 through the current file (video reports as it goes). */
  current: number;
  bytesBefore: number;
  bytesAfter: number;
}

export interface OptimizeResult {
  parsed: ParsedPackage;
  bytesBefore: number;
  bytesAfter: number;
}

const MIN_BYTES = 8 * 1024;

/**
 * Result per original MD5 for this tab, so publishing a draft again reuses
 * the same encoded file (and the storage already holds it). Null keeps the original.
 */
const cache = new Map<string, MediaFile | null>();

/**
 * Animated GIFs would lose their animation and SVG is already small and
 * sharp. Sniffed from the bytes: .oq archives name files by MD5 alone.
 */
function encodable(f: MediaFile): boolean {
  if (f.bytes.byteLength < MIN_BYTES) return false;
  if (f.type !== "image") return true;
  const head = new TextDecoder().decode(f.bytes.subarray(0, 256)).trimStart();
  return !head.startsWith("GIF8") && !head.startsWith("<");
}

/**
 * Re-encodes every local media file the way the Flutter desktop encoder does
 * (AVIF pictures, AV1 or VP9 video and AAC or Opus sound, in MP4) and points
 * the content at the new files. Anything this browser can't encode, or that
 * doesn't get smaller, is uploaded as it was.
 */
export async function optimizePackage(
  parsed: ParsedPackage,
  onProgress: (p: OptimizeProgress) => void,
  signal?: AbortSignal,
): Promise<OptimizeResult> {
  const todo = [...parsed.files.values()].filter(encodable);
  const progress: OptimizeProgress = {
    done: 0,
    total: todo.length,
    current: 0,
    bytesBefore: 0,
    bytesAfter: 0,
  };
  for (const f of parsed.files.values()) {
    progress.bytesBefore += f.bytes.byteLength;
    progress.bytesAfter += f.bytes.byteLength;
  }
  onProgress({ ...progress });

  const remap = new Map<string, MediaFile>();
  try {
    for (const file of todo) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      let out = cache.get(file.md5);
      if (out === undefined) {
        out = await encodeOne(file, (r) => onProgress({ ...progress, current: r }), signal);
        cache.set(file.md5, out);
      }
      if (out) {
        remap.set(file.md5, out);
        progress.bytesAfter -= file.bytes.byteLength - out.bytes.byteLength;
      }
      progress.done += 1;
      progress.current = 0;
      onProgress({ ...progress });
    }
  } finally {
    imageWorker?.terminate();
    imageWorker = undefined;
  }

  if (remap.size === 0) return { parsed, ...progress };
  const files = new Map<string, MediaFile>();
  for (const [md5, f] of parsed.files) {
    const next = remap.get(md5) ?? f;
    files.set(next.md5, next);
  }
  return {
    parsed: { ...parsed, files, content: remapContent(parsed.content, remap) },
    bytesBefore: progress.bytesBefore,
    bytesAfter: progress.bytesAfter,
  };
}

async function encodeOne(
  file: MediaFile,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<MediaFile | null> {
  const mime = mimeFor(file.name);
  let bytes: Uint8Array | null = null;
  let ext = "";
  try {
    if (file.type === "image") {
      const r = await encodeImage(file.bytes, mime);
      if (r) ({ bytes, ext } = r);
    } else {
      bytes = await encodeAv(file.bytes, mime, file.type, onProgress, signal);
      ext = file.type === "audio" ? "m4a" : "mp4";
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    // A file the browser can't decode is uploaded as it is.
    return null;
  }
  if (!bytes || bytes.byteLength > file.bytes.byteLength * (1 - MIN_SAVING)) return null;
  const md5 = md5Hex(bytes);
  return { md5, type: file.type, name: `${md5}.${ext}`, bytes };
}

let imageWorker: Worker | undefined;
let nextJob = 0;

function encodeImage(
  bytes: Uint8Array,
  mime: string,
): Promise<{ bytes: Uint8Array; ext: string } | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined")
    return Promise.resolve(null);
  imageWorker ??= new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
  const worker = imageWorker;
  const id = ++nextJob;
  return new Promise((resolve) => {
    const onMessage = ({ data }: MessageEvent<ImageResult>) => {
      if (data.id !== id) return;
      cleanup();
      resolve(data.ok ? { bytes: data.bytes, ext: data.ext } : null);
    };
    const onError = () => (cleanup(), resolve(null));
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    // A copy: the original stays in the draft and may be uploaded as is.
    const job: ImageJob = { id, bytes: bytes.slice(), mime };
    worker.postMessage(job, [job.bytes.buffer]);
  });
}

/** Swaps every `{ md5 }` file reference in the content for its re-encoded file. */
export function remapContent<T>(content: T, remap: Map<string, MediaFile>): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x);
      if (typeof out.md5 === "string") {
        const next = remap.get(out.md5);
        if (next) out.md5 = next.md5;
      }
      return out;
    }
    return v;
  };
  return walk(content) as T;
}
