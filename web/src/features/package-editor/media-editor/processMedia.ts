import { API_URL } from "@/api/config";
import { md5Hex, detectMediaMime } from "@/features/upload/archive";
import type { MediaFile } from "@/features/upload/types";
import type { ImageJob, ImageResult } from "@/features/upload/optimize/image.worker";
import { MAX_FILE_BYTES, readMediaFile } from "../packageMedia";
import type { AudioVideoEdits, ImageEdits } from "./mediaEdits";

/**
 * Downloads an uploaded file's bytes. The public bucket link is tried first; a
 * bucket (or a CDN cache in front of it) without CORS headers makes that fetch
 * fail with a TypeError, so the API's same-origin copy is the fallback.
 */
async function downloadMedia(file: MediaFile, signal: AbortSignal) {
  const sources = [file.url, `${API_URL}/v1/files/${file.md5}/content`].filter(
    (url): url is string => !!url,
  );
  for (const [index, url] of sources.entries()) {
    const last = index === sources.length - 1;
    let response: Response;
    try {
      response = await fetch(
        url,
        url === file.url ? { signal } : { signal, credentials: "include" },
      );
    } catch (error) {
      if (signal.aborted || last) throw signal.aborted ? error : new Error("downloadFailed");
      continue;
    }
    if (!response.ok) {
      if (last) throw new Error("downloadFailed");
      continue;
    }
    const length = Number(response.headers.get("Content-Length"));
    if (length > MAX_FILE_BYTES) throw new Error("mediaSize");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      // A connection dropped mid-body fails like the fetch itself: try the next copy.
      if (signal.aborted || last) throw signal.aborted ? error : new Error("downloadFailed");
      continue;
    }
    if (md5Hex(bytes) === file.md5) return bytes;
    if (last) throw new Error("downloadCorrupt");
  }
  throw new Error("downloadFailed");
}

export async function acquireMedia(source: File | MediaFile, signal: AbortSignal) {
  const file = source instanceof File ? await readMediaFile(source) : source;
  let bytes = file.bytes;
  if (!bytes.byteLength) bytes = await downloadMedia(file, signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("mediaSize");
  const mime = detectMediaMime(bytes, file.type, file.name);
  const extension: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "audio/webm": "webm",
    "video/webm": "webm",
  };
  return {
    file: {
      ...file,
      bytes,
      ...(extension[mime] ? { name: `${file.md5}.${extension[mime]}` } : {}),
    },
    mime,
  };
}

export function finalizeMediaFile(source: MediaFile, bytes: Uint8Array, ext: string): MediaFile {
  if (!bytes.byteLength || bytes.byteLength > MAX_FILE_BYTES) throw new Error("mediaSize");
  const md5 = md5Hex(bytes);
  return {
    md5,
    type: source.type,
    bytes,
    name: `${md5}.${ext}`,
    displayName: source.displayName ?? source.name,
    preserveEncoding: true,
  };
}

export function encodeEditedImage(
  file: MediaFile,
  mime: string,
  edits: ImageEdits,
  signal: AbortSignal,
) {
  return new Promise<MediaFile>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const worker = new Worker(new URL("../../upload/optimize/image.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error("processingFailed"));
    };
    worker.onmessage = ({ data }: MessageEvent<ImageResult>) => {
      cleanup();
      try {
        if (!data.ok) throw new Error("processingFailed");
        resolve(finalizeMediaFile(file, data.bytes, data.ext));
      } catch (error) {
        reject(error);
      }
    };
    const bytes = file.bytes.slice();
    worker.postMessage({ id: 1, bytes, mime, edits } satisfies ImageJob, [bytes.buffer]);
  });
}

export async function encodeEditedAudioVideo(
  file: MediaFile,
  mime: string,
  edits: AudioVideoEdits,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
) {
  const { encodeAudioVideo } = await import("@/features/upload/optimize/audioVideo");
  const result = await encodeAudioVideo(file.bytes, mime, edits.kind, onProgress, signal, edits);
  if (!result) throw new Error("unsupported");
  return finalizeMediaFile(file, result.bytes, edits.kind === "video" ? "webm" : "m4a");
}
