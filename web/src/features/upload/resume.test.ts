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
import { RESUME_OTHER_SOURCE, resumeFromFile } from "./upload";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("resuming an upload from a picked file", () => {
  afterEach(() => fetchMock.mockReset());

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

    await expect(resumeFromFile(7, parsed, () => {}, false)).rejects.toThrow(RESUME_OTHER_SOURCE);
    // Nothing was saved over the package
    expect(
      fetchMock.mock.calls.some(([input]) => input instanceof Request && input.method === "PUT"),
    ).toBe(false);
  });
});
