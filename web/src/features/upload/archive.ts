import { unzip, unzipSync, type Unzipped } from "fflate";
import SparkMD5 from "spark-md5";

/** Unzips off the main thread where the browser has workers. */
export function readZip(bytes: Uint8Array): Promise<Unzipped> {
  if (typeof Worker === "undefined") {
    try {
      return Promise.resolve(unzipSync(bytes));
    } catch {
      return Promise.reject(new Error("notZip"));
    }
  }
  return new Promise((resolve, reject) =>
    unzip(bytes, (err, files) => (err ? reject(new Error("notZip")) : resolve(files))),
  );
}

export function md5Hex(bytes: Uint8Array): string {
  const view = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return SparkMD5.ArrayBuffer.hash(view as ArrayBuffer);
}

export function md5Base64(hex: string): string {
  let bin = "";
  for (let i = 0; i < hex.length; i += 2)
    bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin);
}

/** Lets the page paint between heavy steps. */
export const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Archive entry lookup that tolerates the ways SIGame packages store names:
 * URL-encoded entries, an "@" prefix on references and different letter case.
 */
export class EntryIndex {
  private exact = new Map<string, string>();
  private folded = new Map<string, string>();

  constructor(private readonly entries: Unzipped) {
    for (const name of Object.keys(entries)) {
      for (const key of [name, safeDecode(name)]) {
        this.exact.set(key, name);
        this.folded.set(key.toLowerCase(), name);
      }
    }
  }

  find(path: string): { name: string; bytes: Uint8Array } | null {
    const candidates = [path, safeDecode(path), encodeURI(path)];
    for (const c of candidates) {
      const name = this.exact.get(c) ?? this.folded.get(c.toLowerCase());
      const bytes = name ? this.entries[name] : undefined;
      if (name && bytes && bytes.length > 0) return { name, bytes };
    }
    return null;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  opus: "audio/opus",
  flac: "audio/flac",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  weba: "audio/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
};

/** Content type for the upload, from the file name. */
export function mimeFor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}
