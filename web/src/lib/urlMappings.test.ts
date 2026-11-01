import { afterEach, describe, expect, it } from "vitest";

import { mapUrl, setUrlMappings } from "./urlMappings";

const here = window.location.origin;

describe("mapUrl", () => {
  afterEach(() => setUrlMappings([]));

  it("leaves URLs alone outside a Discord Activity", () => {
    expect(mapUrl("https://s3.example.com/bucket/a/ab/abc")).toBe(
      "https://s3.example.com/bucket/a/ab/abc",
    );
  });

  it("sends a mapped host through the Activity's own origin, query included", () => {
    setUrlMappings([{ prefix: "/media", target: "s3.example.com" }]);

    expect(mapUrl("https://s3.example.com/bucket/a/ab/abc?X-Amz-Signature=1")).toBe(
      `${here}/media/bucket/a/ab/abc?X-Amz-Signature=1`,
    );
  });

  it("drops the target's path from the forwarded path", () => {
    setUrlMappings([{ prefix: "/api/", target: "example.com/oq" }]);

    expect(mapUrl("https://example.com/oq/v1/me")).toBe(`${here}/api/v1/me`);
  });

  it.each(["https://other.example.com/x", "/v1/me", "not a url ::"])(
    "keeps %j unchanged",
    (url) => {
      setUrlMappings([{ prefix: "/media", target: "s3.example.com" }]);

      expect(mapUrl(url)).toBe(url);
    },
  );
});
