import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MediaFile } from "../types";
import { estimateMediaBytes } from "./estimate";

const mocks = vi.hoisted(() => ({
  video: vi.fn(),
  audio: vi.fn(),
  format: vi.fn(),
  dispose: vi.fn(),
  videoCodec: vi.fn(),
  audioCodec: vi.fn(),
  opus: vi.fn(),
}));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryVideoTrack = mocks.video;
    getPrimaryAudioTrack = mocks.audio;
    getFormat = mocks.format;
    dispose = mocks.dispose;
  },
}));
vi.mock("./audioVideo", () => ({
  pickVideoCodec: mocks.videoCodec,
  pickAudioCodec: mocks.audioCodec,
  canEncodeOpus: mocks.opus,
}));

function file(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    md5: "file",
    name: "sound.wav",
    type: "audio",
    bytes: new Uint8Array(1_000_000),
    ...overrides,
  };
}
function estimate(f: MediaFile, signal?: AbortSignal) {
  return estimateMediaBytes(new Map([[f.md5, f]]), signal);
}
const audioTrack = (duration: number | null = 10) => ({
  getDurationFromMetadata: vi.fn().mockResolvedValue(duration),
  canDecode: vi.fn().mockResolvedValue(true),
});
beforeEach(() => {
  mocks.video.mockResolvedValue(null);
  mocks.audio.mockResolvedValue(audioTrack());
  mocks.format.mockResolvedValue({ name: "WAVE" });
  mocks.videoCodec.mockResolvedValue("vp9");
  mocks.audioCodec.mockResolvedValue("aac");
  mocks.opus.mockResolvedValue(true);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("estimates sound from duration and the real output bitrate", async () => {
  expect(await estimate(file())).toBe(127696); // 10s of AAC plus container allowance
  expect(mocks.dispose).toHaveBeenCalledOnce();
});
it.each([null, NaN, Infinity, 0, -1])(
  "retains the original when duration is %s",
  async (duration) => {
    mocks.audio.mockResolvedValue(audioTrack(duration));
    expect(await estimate(file())).toBe(1_000_000);
    expect(mocks.dispose).toHaveBeenCalledOnce();
  },
);
it("keeps small and editor-prepared media without inspecting it", async () => {
  expect(await estimate(file({ preserveEncoding: true }))).toBe(1_000_000);
  expect(await estimate(file({ bytes: new Uint8Array(100) }))).toBe(100);
  expect(mocks.audio).not.toHaveBeenCalled();
});
it("retains the original for unsupported encoding or unreadable metadata", async () => {
  mocks.audioCodec.mockResolvedValue(null);
  expect(await estimate(file())).toBe(1_000_000);
  mocks.audio.mockRejectedValue(new Error("bad metadata"));
  expect(await estimate(file())).toBe(1_000_000);
  expect(mocks.dispose).toHaveBeenCalledTimes(2);
});
it("does not predict savings when the source cannot be decoded", async () => {
  mocks.audio.mockResolvedValue({ ...audioTrack(), canDecode: async () => false });
  expect(await estimate(file())).toBe(1_000_000);
});
it("retains a smaller compatible original but allows required conversion to grow", async () => {
  const small = file({ bytes: new Uint8Array(10_000) });
  expect(await estimate(small)).toBe(10_000);
  mocks.format.mockResolvedValue({ name: "WebM" });
  expect(await estimate(small)).toBe(127696);
});
it("uses resized video dimensions and capped frame rate, including audio", async () => {
  mocks.video.mockResolvedValue({
    ...audioTrack(),
    codec: "avc",
    getDisplayWidth: async () => 1920,
    getDisplayHeight: async () => 1080,
    computePacketStats: async () => ({ averagePacketRate: 60 }),
  });
  expect(await estimate(file({ type: "video" }))).toBeCloseTo(917088, -1);
});
it("does not strip unsupported audio from the forecast for video", async () => {
  mocks.video.mockResolvedValue({
    ...audioTrack(),
    codec: "avc",
    getDisplayWidth: async () => 640,
    getDisplayHeight: async () => 480,
    computePacketStats: async () => null,
  });
  mocks.opus.mockResolvedValue(false);
  expect(await estimate(file({ type: "video" }))).toBe(1_000_000);
});
it("uses a native image estimate and closes the decoded bitmap", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 800, height: 600, close }));
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      getContext() {
        return { drawImage() {} };
      }
      async convertToBlob() {
        return new Blob([new Uint8Array(5000)], { type: "image/webp" });
      }
    },
  );
  const image = file({ type: "image", name: "image.jpg" });
  expect(await estimate(image)).toBe(5000);
  expect(close).toHaveBeenCalledOnce();
});
it("retains animated images without decoding them", async () => {
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap", decode);
  const bytes = new Uint8Array(10_000);
  bytes.set(new TextEncoder().encode("GIF89a"));
  expect(await estimate(file({ type: "image", name: "animated.gif", bytes }))).toBe(10_000);
  expect(decode).not.toHaveBeenCalled();
});
it("stops stale estimates before starting another file", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(estimate(file(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.audio).not.toHaveBeenCalled();
});
