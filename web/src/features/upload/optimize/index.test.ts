import { expect, it, vi } from "vitest";
import { optimizePackage } from "./index";
import type { ParsedPackage } from "../types";

it.each(["apng", "webp", "avif"])(
  "preserves imported %s animation without starting an encoder",
  async (kind) => {
    const bytes = new Uint8Array(9000);
    if (kind === "apng") {
      bytes.set([137, 80, 78, 71]);
      bytes.set(new TextEncoder().encode("acTL"), 40);
    }
    if (kind === "webp") bytes.set(new TextEncoder().encode("RIFF0000WEBPANIM"));
    if (kind === "avif") bytes.set(new TextEncoder().encode("0000ftypavis"));
    const file = { md5: kind, name: kind, type: "image" as const, bytes };
    const parsed: ParsedPackage = {
      format: "oq",
      content: { title: "Animation", ageRestriction: "NONE", tags: [], rounds: [] },
      files: new Map([[kind, file]]),
      warnings: [],
    };
    const progress = vi.fn();
    const result = await optimizePackage(parsed, progress);
    expect(result.parsed).toBe(parsed);
    expect(result.parsed.files.get(kind)).toBe(file);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ total: 0, bytesAfter: 9000 }));
  },
);
