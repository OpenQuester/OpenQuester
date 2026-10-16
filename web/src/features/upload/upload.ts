import { api, ApiError, unwrap } from "@/api/client";
import type { components } from "@/api/schema";

import { md5Base64, md5Hex, mimeFor, readZip } from "./archive";
import { parseOq } from "./oq";
import { parseSiq } from "./siq";
import type { OptimizeProgress } from "./optimize";
import { clearStash, loadStash, stashFiles, unstashFile } from "./stash";
import type { MediaFile, ParsedPackage } from "./types";

export const ACCEPT = ".siq,.oq";

/** Reads a picked .siq or .oq file. Errors carry an i18n code as their message. */
export async function readPackageFile(file: File): Promise<ParsedPackage> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "siq" && ext !== "oq") throw new Error("wrongType");
  const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
  return ext === "siq" ? parseSiq(entries) : parseOq(entries);
}

export type FileState = "waiting" | "uploading" | "done" | "failed";

/** One media file of an upload, shown in the per-file list. */
export interface FileProgress {
  md5: string;
  name: string;
  type: MediaFile["type"];
  bytes: number;
  sent: number;
  state: FileState;
}

export interface UploadProgress {
  phase: "optimizing" | "creating" | "checking" | "media" | "done";
  /** Media files finished, and the total the server asked for. */
  done: number;
  total: number;
  sentBytes: number;
  totalBytes: number;
  /** Set while media is re-encoded before the upload. */
  optimize?: OptimizeProgress;
  /** Every file being sent, in upload order. */
  files: FileProgress[];
}

/** GET /v1/packages/{id}/upload: which files storage still lacks. */
export type UploadState = components["schemas"]["PackageUploadState"];

export interface UploadResult {
  id: number;
  /** Files the server asked for that failed; resume with `resumeUpload`. */
  failed: PendingFile[];
  /** Media size before and after re-encoding, when it ran. */
  savings?: { before: number; after: number };
  /** What the server confirmed after the upload; null when it couldn't be asked. */
  state: UploadState | null;
}

export interface PendingFile {
  url: string;
  file: MediaFile;
}

const PARALLEL = 3;

const idle = (phase: UploadProgress["phase"]): UploadProgress => ({
  phase,
  done: 0,
  total: 0,
  sentBytes: 0,
  totalBytes: 0,
  files: [],
});

/**
 * Fingerprint of a package file's content, taken before media is re-encoded,
 * so uploading the same file again finds the package it already became.
 */
export function contentHash(parsed: ParsedPackage): string {
  return md5Hex(new TextEncoder().encode(JSON.stringify(parsed.content)));
}

/** Packages already uploaded from a file with this fingerprint. */
export async function findDuplicates(hash: string) {
  const res = await unwrap(
    api.GET("/v1/packages", {
      params: {
        query: { limit: 5, offset: 0, sourceHash: hash, sortBy: "created_at", order: "desc" },
      },
    }),
  );
  return res.data;
}

export function getUploadState(id: number): Promise<UploadState> {
  return unwrap(api.GET("/v1/packages/{id}/upload", { params: { path: { id } } }));
}

/**
 * Same flow as the Flutter client (client/apps/client/lib/src/core/services/package_service.dart):
 * POST /v1/packages with the content, then PUT each media file to the
 * presigned link the server returns for its MD5. Files still to send are
 * stashed in IndexedDB first so an interrupted upload can be resumed, and
 * the server is asked afterwards whether every file arrived.
 */
export async function uploadPackage(
  parsed: ParsedPackage,
  onProgress: (p: UploadProgress) => void,
  /** Replace the content of this published package instead of creating one. */
  replaceId?: number,
  /** Re-encode media in the browser first (AVIF pictures, VP9 WebM video, AAC MP4 sound). */
  optimize = false,
  /** `contentHash` of the picked file; null for edited content; undefined keeps it on replace. */
  sourceHash?: string | null,
): Promise<UploadResult> {
  let savings: UploadResult["savings"];
  if (optimize && parsed.files.size > 0) {
    // Its own chunk: the encoders are only downloaded by people who upload.
    const { optimizePackage } = await import("./optimize");
    const result = await optimizePackage(parsed, (p) =>
      onProgress({ ...idle("optimizing"), optimize: p }),
    );
    parsed = result.parsed;
    savings = { before: result.bytesBefore, after: result.bytesAfter };
  }
  onProgress(idle("creating"));
  // The generated union types are stricter than the server's scheme.
  // Sizes let the server check the storage limits before handing out links.
  const fileSizes: Record<string, number> = {};
  for (const f of parsed.files.values())
    if (f.bytes.byteLength > 0) fileSizes[f.md5] = f.bytes.byteLength;
  const body = {
    content: parsed.content,
    fileSizes,
    ...(sourceHash !== undefined ? { sourceHash } : {}),
  } as never;
  const res = await unwrap(
    replaceId != null
      ? api.PUT("/v1/packages/{id}", { params: { path: { id: replaceId } }, body })
      : api.POST("/v1/packages", { body }),
  );
  let links: Record<string, string> = res.uploadLinks;
  if (replaceId != null && res.uploadStatus !== "ready") {
    // A replaced package mostly reuses stored files: send only what storage lacks.
    onProgress(idle("checking"));
    const state = await getUploadState(res.id).catch(() => null);
    if (state) links = state.uploadLinks;
  }
  const pending: PendingFile[] = [];
  for (const [md5, url] of Object.entries(links)) {
    const file = parsed.files.get(md5.toLowerCase());
    // A file the archive lacked was already reported as a warning before upload;
    // one opened from storage is already there.
    if (file && file.bytes.byteLength > 0) pending.push({ url, file });
  }
  await stashFiles(
    res.id,
    pending.map((p) => p.file),
  );
  const failed = await uploadMedia(res.id, pending, onProgress);
  return { id: res.id, failed, savings, state: await confirm(res.id, onProgress) };
}

/**
 * Finishes an interrupted upload: asks the server which files storage still
 * lacks (with fresh links) and sends those found in `files`.
 */
export async function resumeUpload(
  id: number,
  files: Map<string, MediaFile>,
  onProgress: (p: UploadProgress) => void,
): Promise<UploadResult & { unmatched: string[] }> {
  onProgress(idle("checking"));
  const state = await getUploadState(id);
  if (state.status === "ready") {
    await clearStash(id);
    return { id, failed: [], state, unmatched: [] };
  }
  const pending: PendingFile[] = [];
  const unmatched: string[] = [];
  for (const md5 of state.missing) {
    const file = files.get(md5);
    const url = state.uploadLinks[md5];
    if (file && url && file.bytes.byteLength > 0) pending.push({ url, file });
    else unmatched.push(md5);
  }
  const failed = await uploadMedia(id, pending, onProgress);
  return { id, failed, state: await confirm(id, onProgress), unmatched };
}

/**
 * Resumes from a package file picked again. Its media is matched to the
 * missing files by MD5, first as it is, then re-encoded the way the first
 * upload did. Encoders don't always give the same bytes twice (video), so
 * when files still don't match the package is saved again from this file
 * (same id), and only what storage lacks is sent.
 */
export async function resumeFromFile(
  id: number,
  parsed: ParsedPackage,
  onProgress: (p: UploadProgress) => void,
  optimize: boolean,
): Promise<UploadResult & { unmatched: string[] }> {
  onProgress(idle("checking"));
  const state = await getUploadState(id);
  const covered = (files: Map<string, MediaFile>) => state.missing.every((m) => files.has(m));
  const files = new Map([...(await loadStash(id, state.missing)), ...parsed.files]);
  if (state.status === "ready" || covered(files)) return resumeUpload(id, files, onProgress);

  let source = parsed;
  if (optimize && parsed.files.size > 0) {
    const { optimizePackage } = await import("./optimize");
    source = (
      await optimizePackage(parsed, (p) => onProgress({ ...idle("optimizing"), optimize: p }))
    ).parsed;
    for (const [md5, f] of source.files) files.set(md5, f);
    if (covered(files)) return resumeUpload(id, files, onProgress);
  }
  const result = await uploadPackage(source, onProgress, id, false, contentHash(parsed));
  return { ...result, unmatched: [] };
}

/** Asks the server whether every file arrived; a finished package drops its stash. */
async function confirm(
  id: number,
  onProgress: (p: UploadProgress) => void,
): Promise<UploadState | null> {
  onProgress(idle("checking"));
  const state = await getUploadState(id).catch(() => null);
  if (state?.status === "ready") await clearStash(id);
  onProgress(idle("done"));
  return state;
}

async function uploadMedia(
  packageId: number,
  pending: PendingFile[],
  onProgress: (p: UploadProgress) => void,
): Promise<PendingFile[]> {
  const totalBytes = pending.reduce((n, p) => n + p.file.bytes.byteLength, 0);
  const queue = pending.map((item) => ({
    item,
    row: {
      md5: item.file.md5,
      name: item.file.name,
      type: item.file.type,
      bytes: item.file.bytes.byteLength,
      sent: 0,
      state: "waiting",
    } as FileProgress,
  }));
  const files = queue.map((q) => q.row);
  let done = 0;
  const report = (phase: UploadProgress["phase"]) =>
    onProgress({
      phase,
      done,
      total: pending.length,
      sentBytes: files.reduce((a, f) => a + f.sent, 0),
      totalBytes,
      files: files.map((f) => ({ ...f })),
    });
  report("media");

  const failed: PendingFile[] = [];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { item, row } = next;
      row.state = "uploading";
      report("media");
      try {
        await put(item, (n) => {
          row.sent = n;
          report("media");
        });
        row.sent = row.bytes;
        row.state = "done";
        void unstashFile(packageId, item.file.md5);
      } catch {
        row.sent = 0;
        row.state = "failed";
        failed.push(item);
      }
      done += 1;
      report("media");
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, pending.length) }, worker));
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
