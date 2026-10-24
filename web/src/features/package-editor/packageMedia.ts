import { zipSync } from "fflate";

import { md5Hex, mimeFor } from "@/features/upload/archive";
import type { MediaFile, MediaType, ParsedPackage } from "@/features/upload/types";

import { reachableMedia, toUpload, type DraftPackage } from "./packageDraft";

/** The server's media types, from the browser's MIME type or the extension. */
export function mediaTypeOf(file: { name: string; type: string }): MediaType | null {
  const mime = file.type || mimeFor(file.name);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return null;
}

/** Same per-file ceiling the upload page warns about; the server's S3 policy is the real limit. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export async function readMediaFile(file: File): Promise<MediaFile> {
  const type = mediaTypeOf(file);
  if (!type) throw new Error("mediaType");
  if (file.size > MAX_FILE_BYTES) throw new Error("mediaSize");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const md5 = md5Hex(bytes);
  // Name by hash like an .oq archive; the extension keeps the upload content type.
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  return { md5, type, name: ext ? `${md5}.${ext}` : md5, bytes, displayName: file.name };
}

const urls = new WeakMap<MediaFile, string>();

export function releaseMediaUrl(file: MediaFile) {
  const url = urls.get(file);
  if (url) URL.revokeObjectURL(url);
  urls.delete(file);
}

/** An object URL for a stored file, made once per file and kept for the tab. */
export function mediaUrl(file: MediaFile | undefined): string | undefined {
  if (!file) return undefined;
  if (file.url && file.bytes.byteLength === 0) return file.url;
  let url = urls.get(file);
  if (!url) {
    url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: mimeFor(file.name) }));
    urls.set(file, url);
  }
  return url;
}

/** What the upload flow takes: content plus exactly the media still referenced. */
export function toParsed(pkg: DraftPackage, media: Map<string, MediaFile>): ParsedPackage {
  const files = new Map<string, MediaFile>();
  for (const md5 of reachableMedia(pkg)) {
    const f = media.get(md5);
    if (f) files.set(md5, f);
  }
  return { format: "oq", content: toUpload(pkg), files, warnings: [] };
}

/**
 * An .oq archive the Flutter editor and this app's upload page both read:
 * content.json plus files/<md5>. Media is stored, not recompressed. Files
 * opened from a published package live in storage, so they are downloaded
 * for the archive; if one can't be, the export fails instead of leaving
 * questions without their media.
 */
export async function exportOq(pkg: DraftPackage, media: Map<string, MediaFile>): Promise<Blob> {
  const parsed = toParsed(pkg, media);
  const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    "content.json": new TextEncoder().encode(JSON.stringify(parsed.content, null, 2)),
  };

  for (const md5 of reachableMedia(pkg)) {
    const f = parsed.files.get(md5);
    if (!f) throw new ExportMediaError(md5);
    const bytes = f.bytes.byteLength > 0 ? f.bytes : await downloadStored(f);
    entries[`files/${f.md5}`] = [bytes, { level: 0 }];
  }

  const zip = zipSync(entries, { level: 6 });
  return new Blob([zip as BlobPart], { type: "application/zip" });
}

/** Thrown when a stored file can't be fetched for an export. */
export class ExportMediaError extends Error {
  constructor(public readonly fileName: string) {
    super(`Couldn't download ${fileName}`);
    this.name = "ExportMediaError";
  }
}

async function downloadStored(file: MediaFile): Promise<Uint8Array> {
  if (!file.url) throw new ExportMediaError(file.name);

  const res = await fetch(file.url).catch(() => null);
  if (!res?.ok) throw new ExportMediaError(file.name);

  return new Uint8Array(await res.arrayBuffer());
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFileName(title: string): string {
  return (title.trim() || "package").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}
