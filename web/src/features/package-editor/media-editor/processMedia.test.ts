import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { md5Hex } from "@/features/upload/archive";
import type { MediaFile } from "@/features/upload/types";

import { acquireMedia } from "./processMedia";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const md5 = md5Hex(png);
const bucketUrl = `https://s3.example/${md5}`;
const stored: MediaFile = {
  md5,
  type: "image",
  name: md5,
  bytes: new Uint8Array(),
  url: bucketUrl,
};
const upstream = vi.fn<typeof fetch>();

beforeEach(() => {
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => vi.unstubAllGlobals());

describe("acquireMedia download", () => {
  it("uses the public bucket link when it is readable", async () => {
    upstream.mockResolvedValue(new Response(png.slice()));
    const { file, mime } = await acquireMedia(stored, new AbortController().signal);
    expect(mime).toBe("image/png");
    expect(file.bytes).toEqual(png);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0]?.[0]).toBe(bucketUrl);
  });

  it("falls back to the API copy when the bucket blocks CORS", async () => {
    upstream
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(png.slice()));
    const { file } = await acquireMedia(stored, new AbortController().signal);
    expect(file.bytes).toEqual(png);
    expect(upstream.mock.calls[1]?.[0]).toBe(`/v1/files/${md5}/content`);
    expect(upstream.mock.calls[1]?.[1]).toMatchObject({ credentials: "include" });
  });

  it("falls back to the API copy when the bucket body is cut off", async () => {
    const cutOff = new Response(png.slice());
    vi.spyOn(cutOff, "arrayBuffer").mockRejectedValue(new TypeError("network error"));
    upstream.mockResolvedValueOnce(cutOff).mockResolvedValueOnce(new Response(png.slice()));
    const { file } = await acquireMedia(stored, new AbortController().signal);
    expect(file.bytes).toEqual(png);
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("reports a failed download when both sources fail", async () => {
    upstream
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await expect(acquireMedia(stored, new AbortController().signal)).rejects.toThrow(
      "downloadFailed",
    );
  });

  it("reports a mismatch when no source returns the expected bytes", async () => {
    upstream.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
    await expect(acquireMedia(stored, new AbortController().signal)).rejects.toThrow(
      "downloadCorrupt",
    );
  });

  it("stops on abort without trying the fallback", async () => {
    const controller = new AbortController();
    upstream.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(acquireMedia(stored, controller.signal)).rejects.toThrow("Aborted");
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});
