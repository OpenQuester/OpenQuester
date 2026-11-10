import { afterEach, describe, expect, it, vi } from "vitest";

import { mapUrl, setUrlMappings } from "./urlMappings";

const here = window.location.origin;

describe("mapUrl", () => {
  afterEach(() => {
    setUrlMappings([]);
    vi.unstubAllEnvs();
  });

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

  it("maps only unsigned dev storage objects in local development", () => {
    const path = "/a/ab/abcdef0123456789abcdef0123456789";
    const src = `https://s3-dev.openquester.app${path}`;
    vi.stubEnv("OQ_DEV_MEDIA_PROXY", "");
    expect(mapUrl(src)).toBe(src);
    vi.stubEnv("OQ_DEV_MEDIA_PROXY", "1");
    expect(mapUrl(`${src}#t=1`)).toBe(`${here}/__oq-dev-media${path}#t=1`);
    for (const other of [
      `${src}?signature=1`,
      `https://other.example.com${path}`,
      "https://s3-dev.openquester.app/other",
    ]) {
      expect(mapUrl(other)).toBe(other);
    }
    setUrlMappings([{ prefix: "/discord-media", target: "s3-dev.openquester.app" }]);
    expect(mapUrl(src)).toBe(`${here}/discord-media${path}`);
    setUrlMappings([]);
    vi.stubEnv("DEV", false);
    expect(mapUrl(src)).toBe(src);
  });

  it.each(["https://other.example.com/x", "/v1/me", "not a url ::"])(
    "keeps %j unchanged",
    (url) => {
      setUrlMappings([{ prefix: "/media", target: "s3.example.com" }]);

      expect(mapUrl(url)).toBe(url);
    },
  );
});
