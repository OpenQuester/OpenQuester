import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  Mp4OutputFormat,
  QUALITY_LOW,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type VideoCodec,
} from "mediabunny";

import { AAC_BITRATE, fitBox, MAX_FPS, OPUS_BITRATE } from "./limits";

let videoCodec: Promise<VideoCodec | null> | undefined;
let audioCodec: Promise<AudioCodec | null> | undefined;

/**
 * AV1 squeezes the most (it is what the Flutter encoder writes); VP9 is the
 * fallback where the browser has no AV1 encoder.
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

/**
 * Sound is AAC where the browser can encode it: Safari on iPhone and iPad
 * plays WebM Opus through <audio> as silence (WebKit bug 238546), while AAC
 * in MP4 plays everywhere. Opus in MP4 is the fallback (Chrome on Linux has
 * no AAC encoder); recent Safari plays that too.
 */
export function pickAudioCodec(): Promise<AudioCodec | null> {
  audioCodec ??= (async () => {
    if (typeof AudioEncoder === "undefined") return null;
    for (const codec of ["aac", "opus"] as const)
      if (
        await canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: 48_000 }).catch(() => false)
      )
        return codec;
    return null;
  })();
  return audioCodec;
}

/**
 * Re-encodes audio or video into MP4 (fast start, so playback begins before
 * the whole file arrives). Returns null when this browser can't decode the
 * source or encode the target, so the caller keeps the original.
 */
export async function encodeAv(
  bytes: Uint8Array,
  mime: string,
  kind: "audio" | "video",
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  const sound = await pickAudioCodec();
  if (!sound) return null;
  const codec = kind === "video" ? await pickVideoCodec() : null;
  if (kind === "video" && !codec) return null;

  const input = new Input({
    source: new BlobSource(new Blob([bytes as BlobPart], { type: mime })),
    formats: ALL_FORMATS,
  });
  try {
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
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
        codec: sound,
        bitrate: sound === "aac" ? AAC_BITRATE : OPUS_BITRATE,
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
