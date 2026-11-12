// @vitest-environment node
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MediaFile, UploadContent } from "@/features/upload/types";
import { md5Hex } from "@/features/upload/archive";
import { parseOq } from "@/features/upload/oq";
import { uploadPackage } from "@/features/upload/upload";
import { loadServerPackage } from "./loadPublishedPackage";
import { playableNumericContent } from "./numericAnswer";

import { ExportMediaError, exportOq } from "./packageMedia";
import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "./packageDraft";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));

const MD5 = "a".repeat(32);

function packageUsing(md5: string) {
  const pkg = emptyPackage("Published");
  const round = newRound("Round 1");
  const question = newQuestion(100, {
    text: "Look",
    answerText: "Here",
    questionFiles: [{ md5, type: "image", displayTime: 5000 }],
  });
  round.themes = [newTheme("Pictures", [question])];
  pkg.rounds = [round];
  return pkg;
}

const stored: MediaFile = {
  md5: MD5,
  type: "image",
  name: `${MD5}.png`,
  bytes: new Uint8Array(),
  url: "https://files.test/a.png",
};

describe("exporting a draft opened from a published package", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("publishes, reopens and exports resolved select rights without authoring diagnostics", async () => {
    const question = newQuestion(100, {
      text: "Pick one",
      answerType: "select",
      rightAnswers: ["Stored alias"],
      correctChoiceOptionId: "C",
      options: [
        { id: "A", sourceLabel: "A", text: "B", file: null },
        { id: "B", sourceLabel: "B", text: "Same", file: null },
        { id: "C", sourceLabel: "C", text: "Same", file: null },
      ],
      selectSource: {
        rightLabels: ["C", "B"],
        unresolvedOptions: [{ order: 0, sourceLabel: "A", kind: "unknown", value: "raw" }],
      },
      compatibilityIssues: [
        {
          code: "siqCompatibility",
          where: "source",
          feature: "select",
          severity: "warning",
          resolution: "converted",
        },
      ],
    });
    const pkg = {
      ...emptyPackage("Select"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
    };
    let saved: UploadContent | undefined;
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (
          (request.method === "POST" && path === "/v1/packages") ||
          (request.method === "PUT" && path === "/v1/packages/7")
        ) {
          writes.push(request.method);
          saved = (await request.json()).content as UploadContent;
          return Response.json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
        }
        if (request.method === "GET" && path === "/v1/packages/7") return Response.json(saved);
        if (path === "/v1/packages/7/upload") {
          return Response.json({ id: 7, status: "ready", uploadLinks: {}, missing: [] });
        }
        throw new Error(`Unexpected ${request.method} ${path}`);
      }),
    );
    const upload = (draft: typeof pkg, id?: number) =>
      uploadPackage(
        {
          format: "oq",
          content: playableNumericContent(toUpload(draft)),
          files: new Map(),
          warnings: [],
        },
        () => {},
        id,
      );

    const invalid = structuredClone(pkg);
    invalid.rounds[0]!.themes[0]!.questions[0]!.selectSource!.rightLabels.push("Z");
    await expect(upload(invalid)).rejects.toThrow("compatibilityNeedsRepair");
    expect(writes).toEqual([]);
    await upload(pkg);
    const published = saved!.rounds[0]!.themes[0]!.questions[0]!;
    expect(published.selectSource).toEqual({ rightLabels: ["C", "B"] });
    expect(published).not.toHaveProperty("compatibilityIssues");
    expect(published.rightAnswers).toEqual(["Stored alias"]);

    const reopened = await loadServerPackage(7);
    await upload(reopened.pkg, 7);
    const replaced = await loadServerPackage(7);
    const blob = await exportOq(replaced.pkg, replaced.media);
    const archive = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));
    const restored = archive.content.rounds[0]!.themes[0]!.questions[0]!;
    expect(writes).toEqual(["POST", "PUT"]);
    expect(restored.selectSource).toEqual({ rightLabels: ["C", "B"] });
    expect(restored.correctChoiceOrder).toBe(2);
    expect(restored.rightAnswers).toEqual(["Stored alias"]);
    expect(question.selectSource?.rightLabels).toEqual(["C", "B"]);
  });

  it("round-trips published scripts without inventing a main text step", async () => {
    const script = {
      version: 1,
      steps: [
        { op: "showContent", phase: "question", orders: [0] },
        { op: "setAnswerType", answerType: "number" },
        { op: "askAnswer", mode: "direct", durationMs: 15000 },
      ],
    } satisfies NonNullable<ReturnType<typeof newQuestion>["script"]>;
    const scripted = (price: number | null) =>
      newQuestion(price, {
        script,
        ...(price == null ? { realPrice: 1200 } : {}),
        answerText: "42",
        answerNumber: 42,
        textItems: [
          { id: "prompt", order: 1, scriptOrder: 0, text: "First number", durationMs: 1000 },
        ],
      });
    const mainText = newQuestion(700, {
      text: "Main prompt",
      textPosition: 0,
      mainTextFirst: false,
      textItems: [{ id: "intro", order: 0, text: "Intro" }],
    });
    const blank = newQuestion(800, { textDurationMs: 500, answerText: "Answer" });
    const published = toUpload({
      ...emptyPackage("Scripted"),
      rounds: [
        { ...newRound("Round"), themes: [newTheme("Theme", [scripted(600), mainText, blank])] },
        { ...newRound("Final", "final"), themes: [newTheme("Final", [scripted(null)])] },
      ],
    });
    const scripts = (content: UploadContent) =>
      content.rounds.map((round) => round.themes[0]!.questions[0]!);
    for (const question of scripts(published)) {
      Object.assign(question, {
        text: null,
        textOrder: null,
        textDurationMs: 1000,
        textWaitForFinish: true,
      });
    }
    let requestContent: UploadContent | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (request.method === "GET" && path === "/v1/packages/7") return Response.json(published);
        if (request.method === "POST" && path === "/v1/packages") {
          requestContent = (await request.json()).content as UploadContent;
          return Response.json({ id: 7, uploadStatus: "ready", uploadLinks: {} });
        }
        if (path === "/v1/packages/7/upload")
          return Response.json({ id: 7, status: "ready", uploadLinks: {}, missing: [] });
        throw new Error(`Unexpected ${request.method} ${path}`);
      }),
    );
    const { pkg, media } = await loadServerPackage(7);
    pkg.title = "Edited title";
    const archive = unzipSync(new Uint8Array(await (await exportOq(pkg, media)).arrayBuffer()));
    const manifest = JSON.parse(new TextDecoder().decode(archive["content.json"])) as UploadContent;
    for (const question of scripts(manifest)) {
      expect(question).toMatchObject({
        text: null,
        textOrder: null,
        textItems: [{ order: 0, durationMs: 1000 }],
        script,
      });
    }
    expect(manifest.rounds[0]!.themes[0]!.questions[1]).toMatchObject({
      text: "Main prompt",
      textOrder: 1,
    });
    expect(manifest.rounds[0]!.themes[0]!.questions[2]).toMatchObject({
      textOrder: 0,
      textDurationMs: 500,
    });
    expect(scripts(manifest)[1]).toMatchObject({ price: null, realPrice: 1200 });

    for (const question of scripts(manifest)) {
      Object.assign(question, { textOrder: 0, textDurationMs: 1000, textWaitForFinish: true });
    }
    const imported = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(manifest)),
    });
    await uploadPackage(imported, () => {});
    for (const question of scripts(requestContent!))
      expect(question).toMatchObject({
        textOrder: null,
        textItems: [{ order: 0, durationMs: 1000 }],
        script,
      });
  });

  it("downloads media that only lives in storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([7, 8, 9]))),
    );

    const blob = await exportOq(packageUsing(MD5), new Map([[MD5, stored]]));
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect([...files[`files/${MD5}`]!]).toEqual([7, 8, 9]);
  });

  it("fails instead of leaving the media out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(exportOq(packageUsing(MD5), new Map([[MD5, stored]]))).rejects.toBeInstanceOf(
      ExportMediaError,
    );
  });

  it("refuses an archive when a referenced media record is missing", async () => {
    await expect(exportOq(packageUsing(MD5), new Map())).rejects.toBeInstanceOf(ExportMediaError);
  });

  it("round-trips remote and local media without downloading unused files", async () => {
    const remoteBytes = new Uint8Array([7, 8, 9]);
    const localBytes = new Uint8Array([10, 11, 12]);
    const remoteId = md5Hex(remoteBytes);
    const localId = md5Hex(localBytes);
    const pkg = packageUsing(remoteId);
    pkg.rounds[0]!.themes[0]!.questions[0]!.playMediaSimultaneously = false;
    pkg.rounds[0]!.themes[0]!.questions[0]!.answerFiles = [
      { md5: localId, type: "image", displayTime: 5000 },
    ];
    pkg.logo = { md5: remoteId, type: "image" };
    const fetch = vi.fn(async () => new Response(remoteBytes));
    vi.stubGlobal("fetch", fetch);
    const media = new Map<string, MediaFile>([
      [remoteId, { ...stored, md5: remoteId }],
      [localId, { ...stored, md5: localId, bytes: localBytes }],
      [MD5, stored],
    ]);
    const blob = await exportOq(pkg, media);
    const parsed = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));
    expect(parsed.warnings).toEqual([]);
    expect(
      fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!.playMediaSimultaneously,
    ).toBe(false);
    expect([...parsed.files.keys()].sort()).toEqual([remoteId, localId].sort());
    expect(parsed.files.get(remoteId)?.bytes).toEqual(remoteBytes);
    expect(parsed.files.get(localId)?.bytes).toEqual(localBytes);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(stored.url);
  });

  it("keeps an image choice selection and its bytes through an actual archive", async () => {
    const bytes = new Uint8Array([10, 11, 12]);
    const md5 = md5Hex(bytes);
    const pkg = emptyPackage("Choice");
    const q = newQuestion(100, {
      type: "choice",
      text: "Q",
      correctChoiceOptionId: "image",
      options: [
        { id: "other", text: "Other", file: null },
        { id: "image", text: "", file: { md5, type: "image" } },
      ],
    });
    pkg.rounds = [{ ...newRound("Round"), themes: [newTheme("Theme", [q])] }];
    const media = new Map([[md5, { md5, type: "image" as const, name: "image.png", bytes }]]);
    const blob = await exportOq(pkg, media);
    const parsed = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));
    const restored = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
    expect(
      restored.options.find((option) => option.id === restored.correctChoiceOptionId)?.file?.md5,
    ).toBe(md5);
    expect(parsed.files.get(md5)?.bytes).toEqual(bytes);
  });
});

it("round-trips every legacy OQ mechanic and native point geometry (A04/A28)", async () => {
  const bytes = new Uint8Array([10, 11, 12]);
  const md5 = md5Hex(bytes);
  const answerPoint = { x: 0.2, y: 0.7, imageAspectRatio: 2 };
  const legacyMechanics = [
    { type: "simple" },
    { type: "stake", subType: "simple", maxPrice: 900 },
    {
      type: "secret",
      subType: "customPrice",
      transferType: "exceptCurrent",
      allowedPrices: [100, 300],
    },
    { type: "noRisk", subType: "forEveryone", priceMultiplier: 2 },
    { type: "hidden", isHidden: true },
    {
      type: "choice",
      showDelay: 800,
      answers: [
        { order: 0, text: "Correct", file: null },
        { order: 1, text: "Other", file: null },
      ],
    },
    {
      type: "simple",
      answerType: "point",
      answerPoint,
      answerDeviation: 0.05,
      questionFiles: [{ order: 0, displayTime: 5000, file: { md5, type: "image" } }],
    },
  ];
  const questions = legacyMechanics.map((fields, order) => ({
    ...fields,
    order,
    price: (order + 1) * 100,
    text: "Legacy prompt",
    answerText: "Correct",
  }));
  const source = {
    title: "Legacy OpenQuester",
    rounds: [{ type: "simple", name: "Round", themes: [{ name: "Theme", questions }] }],
  };
  const parsed = await parseOq({
    "content.json": new TextEncoder().encode(JSON.stringify(source)),
    ["files/" + md5]: bytes,
  });
  const blob = await exportOq(fromUpload(parsed.content), parsed.files);
  const restored = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));

  for (const archive of [parsed, restored]) {
    expect(archive.warnings).toEqual([]);
    const saved = archive.content.rounds[0]!.themes[0]!.questions;
    expect(saved).toMatchObject(questions);
    expect(saved[5]).not.toHaveProperty("correctChoiceOrder");
    expect(saved[6]).not.toHaveProperty("pointImageOrder");
    expect(saved[6]?.answerPoint).toEqual(answerPoint);
    expect(archive.files.get(md5)?.bytes).toEqual(bytes);
  }
});

it("keeps an imported point metric and duplicate target occurrence through archive export (A11/A12/A14)", async () => {
  const bytes = new Uint8Array([10, 11, 12]);
  const md5 = md5Hex(bytes);
  const pkg = packageUsing(md5);
  const q = pkg.rounds[0]!.themes[0]!.questions[0]!;
  q.answerType = "point";
  q.questionFiles = [
    { occurrenceId: "first", md5, type: "image", displayTime: 5000 },
    { occurrenceId: "last", md5, type: "image", displayTime: 5000 },
  ];
  q.pointImageId = "last";
  q.answerPoint = {
    x: 0.5,
    y: 0.5,
    imageAspectRatio: 2,
    sourceGeometry: { kind: "sigame", aspectRatio: 1 },
  };
  q.answerDeviation = 0.02;
  const media = new Map([[md5, { md5, type: "image" as const, name: "point.png", bytes }]]);
  const blob = await exportOq(pkg, media);
  const parsed = await parseOq(unzipSync(new Uint8Array(await blob.arrayBuffer())));
  const saved = parsed.content.rounds[0]!.themes[0]!.questions[0]!;
  expect(saved.answerPoint).toEqual(q.answerPoint);
  expect(saved.answerDeviation).toBe(0.02);
  expect(saved.pointImageOrder).toBe(saved.questionFiles!.at(-1)!.order);
  expect(saved.pointImageOrder).not.toBe(saved.questionFiles![0]!.order);
});
