import { ALL_FORMATS, BlobSource, Input } from "mediabunny";

import { detectMediaMime, isStillImage } from "../archive";
import type { MediaFile } from "../types";
import { canEncodeOpus, pickAudioCodec, pickVideoCodec } from "./audioVideo";
import {
  AAC_BITRATE,
  fitBox,
  MAX_FPS,
  MIN_BYTES,
  MIN_SAVING,
  OPUS_BITRATE,
  VP9_BITS_PER_PIXEL,
} from "./limits";

/** A quick forecast, not an encoding pass. Unknown/unsupported files keep their size. */
export async function estimateMediaBytes(files: Map<string, MediaFile>, signal?: AbortSignal) {
  let total = 0;
  for (const file of files.values()) {
    signal?.throwIfAborted();
    let size = file.bytes.byteLength;
    if (!file.preserveEncoding && size >= MIN_BYTES) {
      try {
        const mime = detectMediaMime(file.bytes, file.type, file.name);
        const estimate =
          file.type === "image"
            ? await estimateImage(file, mime)
            : await estimateAudioVideo(file, mime);
        if (estimate && Number.isFinite(estimate.bytes) && estimate.bytes > 0) {
          if (estimate.required || estimate.bytes < size * (1 - MIN_SAVING))
            size = Math.ceil(estimate.bytes);
        }
      } catch {
        // Inspection must never stop an upload. The real encoder also falls back.
      }
    }
    signal?.throwIfAborted();
    total += size;
  }
  return total;
}

async function estimateImage(file: MediaFile, mime: string) {
  if (!isStillImage(file.bytes, mime)) return null;
  const bitmap = await createImageBitmap(new Blob([file.bytes as BlobPart], { type: mime }));
  try {
    const { width, height } = fitBox(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    // Native WebP is a quick proxy; the final worker normally produces AVIF.
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    return blob.type === "image/webp" ? { bytes: blob.size, required: false } : null;
  } finally {
    bitmap.close();
  }
}

async function estimateAudioVideo(file: MediaFile, mime: string) {
  if (file.type === "video" && !(await pickVideoCodec())) return null;
  const input = new Input({
    source: new BlobSource(new Blob([file.bytes as BlobPart], { type: mime })),
    formats: ALL_FORMATS,
  });
  try {
    const video = file.type === "video" ? await input.getPrimaryVideoTrack() : null;
    const audio = await input.getPrimaryAudioTrack();
    if (file.type === "video" ? !video : !audio) return null;
    let bytes = 0;
    for (const track of [video, audio]) {
      if (!track) continue;
      const duration = await track.getDurationFromMetadata();
      if (
        duration === null ||
        duration <= 0 ||
        !Number.isFinite(duration) ||
        !(await track.canDecode())
      )
        return null;
      if (track === video) {
        const size = fitBox(await video.getDisplayWidth(), await video.getDisplayHeight());
        const stats = await video.computePacketStats(60).catch(() => null);
        const fps = Math.min(stats?.averagePacketRate ?? MAX_FPS, MAX_FPS);
        bytes += (duration * size.width * size.height * fps * VP9_BITS_PER_PIXEL) / 8;
      } else {
        const codec =
          file.type === "video"
            ? (await canEncodeOpus())
              ? "opus"
              : null
            : await pickAudioCodec();
        if (!codec) return null;
        bytes += (duration * (codec === "aac" ? AAC_BITRATE : OPUS_BITRATE)) / 8;
      }
    }
    const format = await input.getFormat();
    const required =
      (video !== null && !["vp9", "vp8", "avc"].includes(video.codec ?? "")) ||
      (file.type === "audio" && format.name.toLowerCase().includes("webm"));
    // Allow for container headers; variable bitrate and final image codec still vary.
    return { bytes: bytes * 1.03 + 4096, required };
  } finally {
    input.dispose();
  }
}
