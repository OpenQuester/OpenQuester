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

/** Archives and published media often have no extension. Inspect the bytes before decoding. */
export function detectMediaMime(
  bytes: Uint8Array,
  kind: "image" | "audio" | "video",
  name: string,
) {
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, 256));
  if (bytes[0] === 137 && text.slice(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216) return "image/jpeg";
  if (text.startsWith("GIF8")) return "image/gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return "audio/wav";
  if (text.slice(4, 8) === "ftyp")
    return /avif|avis/.test(text.slice(8, 40)) ? "image/avif" : `${kind}/mp4`;
  if (text.trimStart().startsWith("<")) return "image/svg+xml";
  if (text.startsWith("ID3") || (bytes[0] === 255 && (bytes[1]! & 224) === 224))
    return "audio/mpeg";
  if (text.startsWith("fLaC")) return "audio/flac";
  if (text.startsWith("OggS")) return "audio/ogg";
  if (bytes[0] === 26 && bytes[1] === 69) return `${kind}/webm`;
  return mimeFor(name);
}

export function isStillImage(bytes: Uint8Array, mime: string) {
  if (mime === "image/svg+xml" || mime === "image/gif") return false;
  if (mime !== "image/png" && mime !== "image/webp" && mime !== "image/avif") return true;
  const text = new TextDecoder("latin1").decode(
    mime === "image/avif" ? bytes.subarray(0, 64) : bytes,
  );
  if (mime === "image/png" && text.includes("acTL")) return false;
  if (mime === "image/webp" && text.includes("ANIM")) return false;
  if (mime === "image/avif" && text.slice(8, 64).includes("avis")) return false;
  return true;
}
