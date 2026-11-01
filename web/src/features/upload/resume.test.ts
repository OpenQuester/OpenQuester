import { afterEach, describe, expect, it, vi } from "vitest";

// openapi-fetch needs an absolute base URL to build requests in the test DOM
vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));

// The API client keeps the fetch it finds when it is created, so replace it first
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});

import type { ParsedPackage } from "./types";
import { contentHash, RESUME_OTHER_SOURCE, resumeFromFile } from "./upload";
import { optimizePackage } from "./optimize/index";

vi.mock("./optimize/index", () => ({ optimizePackage: vi.fn() }));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("resuming an upload from a picked file", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.mocked(optimizePackage).mockReset();
  });

  it("prepares a replacement once when encoded hashes differ, preserving the source fingerprint", async () => {
    const original = {
      md5: "original",
      type: "audio" as const,
      name: "sound.wav",
      bytes: new Uint8Array(20),
    };
    const encoded = { ...original, md5: "encoded", name: "sound.m4a", bytes: new Uint8Array(10) };
    const parsed: ParsedPackage = {
      format: "oq",
      content: { title: "Same source", rounds: [] } as unknown as ParsedPackage["content"],
      warnings: [],
      files: new Map([[original.md5, original]]),
    };
    vi.mocked(optimizePackage).mockResolvedValue({
      parsed: { ...parsed, files: new Map([[encoded.md5, encoded]]) },
      bytesBefore: 20,
      bytesAfter: 10,
    });
    let replaced = false;
    fetchMock.mockImplementation(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      if (url.pathname.endsWith("/upload"))
        return json({
          id: 7,
          status: replaced ? "ready" : "uploading",
          missing: replaced ? [] : ["other-encoded-hash"],
          uploadLinks: {},
        });
      if (url.pathname === "/v1/packages")
        return json({ data: [{ id: 7 }], pageInfo: { total: 1 } });
      if (request.method === "PUT") {
        expect(await request.json()).toMatchObject({
          fileSizes: { encoded: 10 },
          sourceHash: contentHash(parsed),
        });
        replaced = true;
        return json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
      }
      throw new Error(`Unexpected ${request.method} ${url.pathname}`);
    });
    expect((await resumeFromFile(7, parsed, () => {})).state?.status).toBe("ready");
    expect(optimizePackage).toHaveBeenCalledOnce();
  });

  it("refuses to replace the package from a different file", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/v1/packages/7/upload"))
        return json({
          id: 7,
          status: "uploading",
          totalFiles: 1,
          uploadedFiles: 0,
          missing: ["a".repeat(32)],
          uploadLinks: {},
        });
      if (url.includes("sourceHash=")) return json({ data: [], pageInfo: { total: 0 } });
      throw new Error(`unexpected request ${url}`);
    });
    const parsed: ParsedPackage = {
      format: "oq",
      content: { title: "Other", rounds: [] } as unknown as ParsedPackage["content"],
      files: new Map(),
      warnings: [],
    };

    await expect(resumeFromFile(7, parsed, () => {})).rejects.toThrow(RESUME_OTHER_SOURCE);
    // Nothing was saved over the package
    expect(
      fetchMock.mock.calls.some(([input]) => input instanceof Request && input.method === "PUT"),
    ).toBe(false);
  });

  it.each([0, 5])(
    "can verify the original source at duplicate-list offset %s",
    async (matchOffset) => {
      const parsed: ParsedPackage = {
        format: "oq",
        content: { title: "Same title", rounds: [] } as unknown as ParsedPackage["content"],
        files: new Map(),
        warnings: [],
      };
      let replaced = false;
      const offsets: number[] = [];
      fetchMock.mockImplementation(async (input) => {
        const request = input as Request;
        const url = new URL(request.url);
        if (url.pathname === "/v1/packages/7/upload")
          return json({
            id: 7,
            status: replaced ? "ready" : "uploading",
            totalFiles: 1,
            uploadedFiles: replaced ? 1 : 0,
            missing: replaced ? [] : ["a".repeat(32)],
            uploadLinks: {},
          });
        if (url.pathname === "/v1/packages") {
          expect(url.searchParams.get("sourceHash")).toBe(contentHash(parsed));
          const offset = Number(url.searchParams.get("offset"));
          offsets.push(offset);
          return json({
            data: offset === matchOffset ? [{ id: 7 }] : [8, 9, 10, 11, 12].map((id) => ({ id })),
            pageInfo: { total: matchOffset + 1 },
          });
        }
        if (url.pathname === "/v1/packages/7" && request.method === "PUT") {
          expect(await request.json()).toMatchObject({
            content: parsed.content,
            sourceHash: contentHash(parsed),
          });
          replaced = true;
          return json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
        }
        throw new Error(`unexpected request ${request.method} ${url}`);
      });
      expect((await resumeFromFile(7, parsed, () => {})).state?.status).toBe("ready");
      expect(replaced).toBe(true);
      expect(offsets).toEqual(matchOffset ? [0, 5] : [0]);
    },
  );
});
