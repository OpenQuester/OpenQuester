import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type VideoCodec,
} from "mediabunny";

import { AAC_BITRATE, fitBox, MAX_FPS, OPUS_BITRATE, VP9_BITS_PER_PIXEL } from "./limits";

let videoCodec: Promise<VideoCodec | null> | undefined;
let audioCodec: Promise<AudioCodec | null> | undefined;
let opus: Promise<boolean> | undefined;

/**
 * Video is VP9: AV1 would be smaller, but most iPads can't decode it, while
 * VP9 plays in every current browser (iPhone and iPad from iOS 17.4). Apple
 * plays VP9 only in WebM, so video goes in WebM with Opus sound.
 */
export function pickVideoCodec(): Promise<VideoCodec | null> {
  videoCodec ??= (async () => {
    if (typeof VideoEncoder === "undefined") return null;
    const ok = await canEncodeVideo("vp9", { width: 1280, height: 720 }).catch(() => false);
    return ok ? "vp9" : null;
  })();
  return videoCodec;
}

function canEncodeOpus(): Promise<boolean> {
  opus ??=
    typeof AudioEncoder === "undefined"
      ? Promise.resolve(false)
      : canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000 }).catch(() => false);
  return opus;
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
 * Re-encodes sound into MP4 (fast start) and video into WebM. Returns null
 * when this browser can't decode the source or encode the target, so the
 * caller keeps the original.
 */
export async function encodeAv(
  bytes: Uint8Array,
  mime: string,
  kind: "audio" | "video",
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; required: boolean } | null> {
  const codec = kind === "video" ? await pickVideoCodec() : null;
  if (kind === "video" && !codec) return null;
  // WebM holds Opus (not AAC), so video sound is Opus.
  const sound: AudioCodec | null =
    kind === "video" ? ((await canEncodeOpus()) ? "opus" : null) : await pickAudioCodec();
  if (!sound) return null;

  const input = new Input({
    source: new BlobSource(new Blob([bytes as BlobPart], { type: mime })),
    formats: ALL_FORMATS,
  });
  try {
    // AV1 or HEVC video doesn't play on most iPads; WebM sound is silent on
    // iPhone and iPad. Those are converted even if the result is bigger.
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const sourceFormat = await input.getFormat().catch(() => null);
    const required =
      (video !== null && !["vp9", "vp8", "avc"].includes(video.codec ?? "")) ||
      (kind === "audio" &&
        audio !== null &&
        (sourceFormat?.name ?? "").toLowerCase().includes("webm"));
    const target = new BufferTarget();
    const format =
      kind === "video" ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" });
    const output = new Output({ format, target });
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
              const outFps = Math.min(fps, MAX_FPS);
              return {
                codec: codec!,
                ...size,
                fit: "contain",
                ...(fps > MAX_FPS + 0.5 ? { frameRate: MAX_FPS } : {}),
                // Chrome's VP9 encoder overshoots badly on a quality preset;
                // a fixed bits-per-pixel budget lands near the Flutter AV1 size.
                bitrate: Math.round(size.width * size.height * outFps * VP9_BITS_PER_PIXEL),
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
    return target.buffer ? { bytes: new Uint8Array(target.buffer), required } : null;
  } finally {
    input.dispose();
  }
}
