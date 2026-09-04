import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "./client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a successful HTML response instead of treating the SPA as API data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(apiRequest("/v1/packages")).rejects.toEqual(
      new ApiError(
        "The web client received an invalid API response. Check the configured API URL.",
        502,
      ),
    );
  });

  it("returns JSON from a valid API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: [{ id: 1 }] }, { status: 200 }),
        ),
    );

    await expect(apiRequest("/v1/packages")).resolves.toEqual({
      data: [{ id: 1 }],
    });
  });
});
