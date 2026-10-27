import { afterEach, expect, it, vi } from "vitest";
import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "@/features/package-editor/packageDraft";
import { uploadPackage } from "./upload";
import { PointImageDimensionsError, withPointImageDimensions } from "./pointImageDimensions";
import type { ParsedPackage } from "./types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("times out before HTTP, cleans up and retries with one decode per image", async () => {
  vi.useFakeTimers();
  let hang = true;
  let created = 0;
  const removed = vi.fn();
  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 1200;
    naturalHeight = 600;
    constructor() {
      created++;
    }
    set src(_value: string) {
      if (!hang) queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {
      removed();
    }
  }
  vi.stubGlobal("Image", TestImage);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const item = newQuestion(100, {
    answerType: "point",
    answerPoint: { x: 0.5, y: 0.5 },
    questionFiles: [{ md5: "image", type: "image", displayTime: 5000 }],
  });
  const pkg = {
    ...emptyPackage("Point"),
    rounds: [{ ...newRound("R"), themes: [newTheme("T", [item, { ...item, id: "second" }])] }],
  };
  const parsed: ParsedPackage = {
    format: "oq",
    content: toUpload(pkg),
    warnings: [],
    files: new Map([
      [
        "image",
        {
          md5: "image",
          type: "image",
          name: "image",
          bytes: new Uint8Array(),
          url: "https://example.test/image",
        },
      ],
    ]),
  };
  const result = uploadPackage(parsed, vi.fn());
  const failure = expect(result).rejects.toBeInstanceOf(PointImageDimensionsError);
  await vi.advanceTimersByTimeAsync(15_000);
  await failure;
  expect(fetch).not.toHaveBeenCalled();
  expect(removed).toHaveBeenCalledTimes(1);
  hang = false;
  const retry = withPointImageDimensions(parsed);
  await vi.runAllTicks();
  const result2 = await retry;
  expect(created).toBe(2);
  expect(
    result2.content.rounds[0]!.themes[0]!.questions.map((q) => q.answerPoint?.imageAspectRatio),
  ).toEqual([2, 2]);
  expect(parsed.content.rounds[0]!.themes[0]!.questions[0]!.answerPoint).not.toHaveProperty(
    "imageAspectRatio",
  );
});

it("measures the first image by question order and replaces stale metadata", async () => {
  const sources: string[] = [];
  class TestImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(value: string) {
      sources.push(value);
      this.naturalWidth = value.endsWith("portrait") ? 600 : 1200;
      this.naturalHeight = value.endsWith("portrait") ? 1200 : 600;
      queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  }
  vi.stubGlobal("Image", TestImage);
  const q = newQuestion(100, {
    answerType: "point",
    answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
    questionFiles: [
      { md5: "landscape", type: "image", displayTime: 1000 },
      { md5: "portrait", type: "image", displayTime: 1000 },
    ],
  });
  const content = toUpload({
    ...emptyPackage("Point"),
    rounds: [{ ...newRound("R"), themes: [newTheme("T", [q])] }],
  });
  const files = new Map(
    ["landscape", "portrait"].map((name) => [
      name,
      {
        md5: name,
        type: "image" as const,
        name,
        bytes: new Uint8Array(),
        url: `https://example.test/${name}`,
      },
    ]),
  );
  content.rounds[0]!.themes[0]!.questions[0]!.questionFiles![0]!.order = 2;
  content.rounds[0]!.themes[0]!.questions[0]!.questionFiles![1]!.order = 1;
  const measured = await withPointImageDimensions({ format: "oq", content, files, warnings: [] });
  expect(sources).toEqual(["https://example.test/portrait"]);
  expect(measured.content.rounds[0]!.themes[0]!.questions[0]!.answerPoint?.imageAspectRatio).toBe(
    0.5,
  );
});
