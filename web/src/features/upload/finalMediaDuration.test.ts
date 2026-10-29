import { afterEach, expect, it, vi } from "vitest";
import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "@/features/package-editor/packageDraft";
import { question } from "@/game/fixtures";
import { preparePreviewQuestion } from "@/features/package-editor/playtest/preparePreview";
import { uploadPackage } from "./upload";
import { api } from "@/api/client";
import { exportOq } from "@/features/package-editor/packageMedia";
import { md5Hex, readZip } from "./archive";
import { parseOq } from "./oq";
import { FinalMediaDurationError, withFinalMediaDurations } from "./finalMediaDuration";
import type { ParsedPackage } from "./types";

vi.mock("@/game/media", () => ({ preloadQuestionMedia: vi.fn().mockResolvedValue([]) }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubMedia(duration: number, fail = false) {
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(duration);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (this.getAttribute("src"))
      queueMicrotask(() => this.dispatchEvent(new Event(fail ? "error" : "loadedmetadata")));
  });
}

function example(): ParsedPackage {
  const q = newQuestion(null, {
    text: "Question",
    answerText: "Answer",
    questionFiles: [
      { md5: "video", type: "video", displayTime: null },
      { md5: "audio", type: "audio", displayTime: 7000 },
    ],
  });
  const pkg = {
    ...emptyPackage("Final"),
    rounds: [{ ...newRound("Final"), type: "final" as const, themes: [newTheme("Theme", [q])] }],
  };
  return {
    format: "oq",
    content: toUpload(pkg),
    warnings: [],
    files: new Map([
      [
        "video",
        {
          md5: "video",
          type: "video",
          name: "clip.webm",
          bytes: new Uint8Array(),
          url: "https://example.test/clip.webm",
        },
      ],
      [
        "audio",
        {
          md5: "audio",
          type: "audio",
          name: "audio",
          bytes: new Uint8Array(),
          url: "https://example.test/audio",
        },
      ],
    ]),
  };
}

it("measures a 31-second remote video before publish, retaining explicit lengths and legacy data", async () => {
  stubMedia(31.2341);
  const parsed = example();
  const out = await withFinalMediaDurations(parsed);
  expect(
    out.content.rounds[0]!.themes[0]!.questions[0]!.questionFiles!.map((f) => f.displayTime),
  ).toEqual([31235, 7000]);
  expect(
    parsed.content.rounds[0]!.themes[0]!.questions[0]!.questionFiles![0]!.displayTime,
  ).toBeNull();
  const legacy = example();
  delete legacy.content.rounds[0]!.themes[0]!.questions[0]!.textItems;
  expect(
    (await withFinalMediaDurations(legacy)).content.rounds[0]!.themes[0]!.questions[0]!
      .questionFiles![0]!.displayTime,
  ).toBeNull();
});

it("fails before a publish request when metadata cannot be read or exceeds two minutes", async () => {
  stubMedia(121);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(uploadPackage(example(), vi.fn())).rejects.toMatchObject({ reason: "tooLong" });
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  stubMedia(0, true);
  await expect(uploadPackage(example(), vi.fn())).rejects.toBeInstanceOf(FinalMediaDurationError);
  expect(fetch).not.toHaveBeenCalled();
});

it("names the file when an explicit final display time is invalid", async () => {
  const parsed = example();
  parsed.files.get("video")!.displayName = "original clip.webm";
  parsed.content.rounds[0]!.themes[0]!.questions[0]!.questionFiles![0]!.displayTime = 120_001;
  await expect(uploadPackage(parsed, vi.fn())).rejects.toMatchObject({
    reason: "tooLong",
    fileName: "original clip.webm",
  });
});

it("publishes measured local media duration in the actual package request", async () => {
  stubMedia(31.2341);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-video");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const post = vi.spyOn(api, "POST").mockResolvedValue({
    data: { id: 1, uploadLinks: {} },
    response: new Response(null, { status: 200 }),
  } as never);
  vi.spyOn(api, "GET").mockResolvedValue({
    data: { status: "uploading" },
    response: new Response(null, { status: 200 }),
  } as never);
  const parsed = example();
  parsed.files.get("video")!.bytes = new Uint8Array([1, 2, 3]);
  await uploadPackage(parsed, vi.fn());
  const [, { body }] = post.mock.calls[0] as unknown as [
    string,
    { body: { content: ParsedPackage["content"] } },
  ];
  expect(body.content.rounds[0]!.themes[0]!.questions[0]!.questionFiles![0]!.displayTime).toBe(
    31235,
  );
  expect(revoke).toHaveBeenCalledWith("blob:local-video");
});

it("uses actual media length in final preview and blocks unsupported files", async () => {
  stubMedia(31.2341);
  const q = question(100, {
    textItems: [],
    questionFiles: [
      { order: 0, displayTime: null, file: { md5: "video", type: "video", link: "blob:local" } },
    ],
  });
  const ready = await preparePreviewQuestion(q, new AbortController().signal, true);
  expect(ready.questionFiles![0]!.displayTime).toBe(31235);
  vi.restoreAllMocks();
  stubMedia(121);
  await expect(preparePreviewQuestion(q, new AbortController().signal, true)).rejects.toMatchObject(
    { reason: "tooLong" },
  );
});

it("keeps unresolved durations and file content in an .oq export for preparation after import", async () => {
  stubMedia(31);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:imported");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const md5 = md5Hex(new Uint8Array([1, 2, 3]));
  const item = newQuestion(null, {
    text: "Q",
    answerText: "A",
    questionFiles: [{ md5, type: "video", displayTime: null }],
  });
  const pkg = {
    ...emptyPackage("Final"),
    rounds: [{ ...newRound("Final"), type: "final" as const, themes: [newTheme("Theme", [item])] }],
  };
  const archive = await exportOq(
    pkg,
    new Map([[md5, { md5, type: "video", name: "clip.webm", bytes: new Uint8Array([1, 2, 3]) }]]),
  );
  const imported = await parseOq(await readZip(new Uint8Array(await archive.arrayBuffer())));
  expect(imported.content.rounds[0]!.themes[0]!.questions[0]!.textItems).toEqual([]);
  expect(imported.files.get(md5)?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  expect(
    (await withFinalMediaDurations(imported)).content.rounds[0]!.themes[0]!.questions[0]!
      .questionFiles![0]!.displayTime,
  ).toBe(31_000);
});
