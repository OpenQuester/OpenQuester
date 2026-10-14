import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  QUALITY_LOW,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type VideoCodec,
} from "mediabunny";

import { fitBox, MAX_FPS, OPUS_BITRATE } from "./limits";

let videoCodec: Promise<VideoCodec | null> | undefined;
let opus: Promise<boolean> | undefined;

/**
 * AV1 squeezes the most (it is what the Flutter encoder writes); VP9 is the
 * fallback where the browser has no AV1 encoder. Both go in WebM with Opus.
 */
export function pickVideoCodec(): Promise<VideoCodec | null> {
  videoCodec ??= (async () => {
    if (typeof VideoEncoder === "undefined") return null;
    for (const codec of ["av1", "vp9"] as const)
      if (await canEncodeVideo(codec, { width: 1280, height: 720 }).catch(() => false))
        return codec;
    return null;
  })();
  return videoCodec;
}

export function canEncodeOpus(): Promise<boolean> {
  opus ??=
    typeof AudioEncoder === "undefined"
      ? Promise.resolve(false)
      : canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000 }).catch(() => false);
  return opus;
}

/**
 * Re-encodes audio or video into WebM. Returns null when this browser can't
 * decode the source or encode the target, so the caller keeps the original.
 */
export async function encodeAv(
  bytes: Uint8Array,
  mime: string,
  kind: "audio" | "video",
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  if (!(await canEncodeOpus())) return null;
  const codec = kind === "video" ? await pickVideoCodec() : null;
  if (kind === "video" && !codec) return null;

  const input = new Input({
    source: new BlobSource(new Blob([bytes as BlobPart], { type: mime })),
    formats: ALL_FORMATS,
  });
  try {
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video:
        kind === "audio"
          ? { discard: true }
          : async (track) => {
              const size = fitBox(await track.getDisplayWidth(), await track.getDisplayHeight());
              const stats = await track.computePacketStats(60).catch(() => null);
              const fps = stats?.averagePacketRate ?? MAX_FPS;
              return {
                codec: codec!,
                ...size,
                fit: "contain",
                ...(fps > MAX_FPS + 0.5 ? { frameRate: MAX_FPS } : {}),
                bitrate: QUALITY_LOW,
                forceTranscode: true,
              };
            },
      audio: {
        codec: "opus",
        bitrate: OPUS_BITRATE,
        sampleRate: 48_000,
        forceTranscode: true,
      },
      showWarnings: false,
    });
    // A track we couldn't read or write would silently vanish from the result.
    if (
      !conversion.isValid ||
      conversion.discardedTracks.some((d) => d.reason !== "discarded_by_user")
    )
      return null;
    if (conversion.utilizedTracks.length === 0) return null;
    conversion.onProgress = (p) => onProgress(p);
    const abort = () => void conversion.cancel();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal?.removeEventListener("abort", abort);
    }
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return target.buffer ? new Uint8Array(target.buffer) : null;
  } finally {
    input.dispose();
  }
}
