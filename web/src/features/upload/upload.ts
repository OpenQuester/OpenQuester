import { api, ApiError, unwrap } from "@/api/client";

import { md5Base64, mimeFor, readZip } from "./archive";
import { parseOq } from "./oq";
import { parseSiq } from "./siq";
import type { MediaFile, ParsedPackage } from "./types";

export const ACCEPT = ".siq,.oq";

/** Reads a picked .siq or .oq file. Errors carry an i18n code as their message. */
export async function readPackageFile(file: File): Promise<ParsedPackage> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "siq" && ext !== "oq") throw new Error("wrongType");
  const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
  return ext === "siq" ? parseSiq(entries) : parseOq(entries);
}

export interface UploadProgress {
  phase: "creating" | "media" | "done";
  /** Media files finished, and the total the server asked for. */
  done: number;
  total: number;
  sentBytes: number;
  totalBytes: number;
}

export interface UploadResult {
  id: number;
  /** Files the server asked for that failed; retry with `retryMedia`. */
  failed: PendingFile[];
}

export interface PendingFile {
  url: string;
  file: MediaFile;
}

const PARALLEL = 3;

/**
 * Same flow as the Flutter client (client/apps/client/lib/src/core/services/package_service.dart):
 * POST /v1/packages with the content, then PUT each media file to the
 * presigned link the server returns for its MD5.
 */
export async function uploadPackage(
  parsed: ParsedPackage,
  onProgress: (p: UploadProgress) => void,
  /** Replace the content of this published package instead of creating one. */
  replaceId?: number,
): Promise<UploadResult> {
  onProgress({ phase: "creating", done: 0, total: 0, sentBytes: 0, totalBytes: 0 });
  // The generated union types are stricter than the server's scheme.
  const body = { content: parsed.content } as never;
  const res = await unwrap(
    replaceId != null
      ? api.PUT("/v1/packages/{id}", { params: { path: { id: replaceId } }, body })
      : api.POST("/v1/packages", { body }),
  );
  const pending: PendingFile[] = [];
  for (const [md5, url] of Object.entries(res.uploadLinks)) {
    const file = parsed.files.get(md5.toLowerCase());
    // A file the archive lacked was already reported as a warning before upload;
    // one opened from storage is already there.
    if (file && file.bytes.byteLength > 0) pending.push({ url, file });
  }
  const failed = await uploadMedia(pending, onProgress);
  return { id: res.id, failed };
}

export function retryMedia(
  pending: PendingFile[],
  onProgress: (p: UploadProgress) => void,
): Promise<PendingFile[]> {
  return uploadMedia(pending, onProgress);
}

async function uploadMedia(
  pending: PendingFile[],
  onProgress: (p: UploadProgress) => void,
): Promise<PendingFile[]> {
  const totalBytes = pending.reduce((n, p) => n + p.file.bytes.byteLength, 0);
  const sent = new Map<PendingFile, number>();
  let done = 0;
  const report = (phase: UploadProgress["phase"]) =>
    onProgress({
      phase,
      done,
      total: pending.length,
      sentBytes: [...sent.values()].reduce((a, b) => a + b, 0),
      totalBytes,
    });
  report("media");

  const failed: PendingFile[] = [];
  const queue = [...pending];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const item = next;
      try {
        await put(item, (n) => {
          sent.set(item, n);
          report("media");
        });
        sent.set(item, item.file.bytes.byteLength);
      } catch {
        failed.push(item);
      }
      done += 1;
      report("media");
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, pending.length) }, worker));
  report("done");
  return failed;
}

/** XHR rather than fetch: it reports upload progress. */
export function put(
  { url, file }: PendingFile,
  onSent: (bytes: number) => void = () => {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-MD5", md5Base64(file.md5));
    xhr.setRequestHeader("If-None-Match", "*");
    xhr.setRequestHeader("Content-Type", mimeFor(file.name));
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () =>
      // 412: the storage already has this exact file (another package uses it).
      xhr.status === 412 || (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new ApiError(xhr.statusText || "upload failed", xhr.status));
    xhr.onerror = () => reject(new ApiError("network", 0));
    xhr.send(new Blob([file.bytes as BlobPart]));
  });
}

/** Totals shown before upload. */
export function describe(parsed: ParsedPackage) {
  let questions = 0;
  for (const r of parsed.content.rounds) for (const t of r.themes) questions += t.questions.length;
  let bytes = 0;
  for (const f of parsed.files.values()) bytes += f.bytes.byteLength;
  return { questions, mediaCount: parsed.files.size, bytes };
}
