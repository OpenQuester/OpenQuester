import { expect, it, vi } from "vitest";
import { optimizePackage } from "./index";
import { encodeAudioVideo } from "./audioVideo";
import { withFinalMediaDurations } from "../finalMediaDuration";
import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "@/features/package-editor/packageDraft";
import type { ParsedPackage } from "../types";

vi.mock("./audioVideo", () => ({ encodeAudioVideo: vi.fn() }));

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

it("keeps the current source name after optimization and in duration errors, including cache reuse", async () => {
  vi.mocked(encodeAudioVideo).mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    required: false,
  });
  const bytes = new Uint8Array(9000);
  const question = newQuestion(null, {
    questionFiles: [{ md5: "duration-optimized", type: "video", displayTime: null }],
  });
  const pkg = emptyPackage("Final");
  const round = newRound("Final", "final");
  round.themes = [newTheme("Theme", [question])];
  pkg.rounds = [round];
  const parsed: ParsedPackage = {
    format: "oq",
    content: toUpload(pkg),
    files: new Map([
      [
        "duration-optimized",
        {
          md5: "duration-optimized",
          name: "source.webm",
          displayName: "First.webm",
          type: "video",
          bytes,
        },
      ],
    ]),
    warnings: [],
  };
  const first = await optimizePackage(parsed, vi.fn());
  expect([...first.parsed.files.values()][0]!.displayName).toBe("First.webm");
  const renamed = {
    ...parsed,
    files: new Map([
      [
        "duration-optimized",
        { ...parsed.files.get("duration-optimized")!, displayName: "Second.webm" },
      ],
    ]),
  };
  const second = await optimizePackage(renamed, vi.fn());
  expect([...second.parsed.files.values()][0]!.displayName).toBe("Second.webm");
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:optimized");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const duration = vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(121);
  const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (this.getAttribute("src"))
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
  });
  try {
    await expect(withFinalMediaDurations(second.parsed)).rejects.toMatchObject({
      reason: "tooLong",
      fileName: "Second.webm",
    });
    expect(revoke).toHaveBeenCalledWith("blob:optimized");
  } finally {
    create.mockRestore();
    revoke.mockRestore();
    duration.mockRestore();
    load.mockRestore();
  }
});
