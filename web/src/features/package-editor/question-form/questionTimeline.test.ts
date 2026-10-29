import { describe, expect, it } from "vitest";
import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
  toUploadQuestion,
} from "../packageDraft";
import { questionSteps, syncQuestionFiles, withQuestionSteps } from "./questionTimeline";
import { checkQuestion } from "../validatePackage";
import { parseOq } from "@/features/upload/oq";
import { md5Hex } from "@/features/upload/archive";
import { exportOq, toParsed } from "../packageMedia";
import { unzipSync } from "fflate";

const image = {
  occurrenceId: "image",
  md5: "image-hash",
  type: "image" as const,
  displayTime: 1000,
};
const audio = {
  occurrenceId: "audio",
  md5: "audio-hash",
  type: "audio" as const,
  displayTime: null,
};
const text = (id: string, value: string) => ({
  kind: "text" as const,
  item: { id, text: value, order: 0 },
});

describe("ordered question steps", () => {
  it("serializes, imports and restores mixed text and media with the selected point image", () => {
    const question = newQuestion(100, {
      text: "First",
      answerType: "point",
      answerPoint: { x: 0.5, y: 0.5 },
      pointImageId: "image",
      questionFiles: [image, audio],
    });
    const ordered = withQuestionSteps(question, [
      { kind: "main" },
      { kind: "media", file: audio },
      text("a", "Second"),
      { kind: "media", file: image },
      text("b", "Third"),
    ]);
    const encoded = toUploadQuestion(ordered, 0, false);
    expect(encoded.textOrder).toBe(0);
    expect(encoded.textItems).toEqual([
      { order: 2, text: "Second" },
      { order: 4, text: "Third" },
    ]);
    expect(encoded.questionFiles?.map((file) => file.order)).toEqual([1, 3]);
    expect(encoded.pointImageOrder).toBe(3);
    const pkg = emptyPackage("Package");
    const round = newRound("Round");
    round.themes = [newTheme("Theme", [ordered])];
    pkg.rounds = [round];
    const decoded = fromUpload(toUpload(pkg)).rounds[0]!.themes[0]!.questions[0]!;
    const again = toUploadQuestion(decoded, 0, false);
    expect(again.textItems).toEqual(encoded.textItems);
    expect(again.questionFiles?.map((file) => file.order)).toEqual([1, 3]);
    expect(again.pointImageOrder).toBe(3);
  });

  it("round-trips added text steps through the .oq parser", async () => {
    const pkg = emptyPackage("Package");
    const round = newRound("Round");
    const q = newQuestion(100, {
      text: "First",
      textItems: [{ id: "a", text: "Second", order: 1 }],
    });
    round.themes = [newTheme("Theme", [q])];
    pkg.rounds = [round];
    const content = toUpload(pkg);
    const parsed = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(content)),
    });
    const question = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
    expect(toUploadQuestion(question, 0, false)).toMatchObject({
      textOrder: 0,
      textItems: [{ order: 1, text: "Second" }],
    });
  });

  it("preserves mixed steps and the locked empty main slot through .oq and publish", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const md5 = md5Hex(bytes);
    const file = { ...image, md5 };
    const media = new Map([[md5, { md5, type: "image" as const, name: md5, bytes }]]);
    for (const rest of [
      [{ kind: "media" as const, file }, text("a", "After")],
      [text("a", "Before"), { kind: "media" as const, file }],
      [text("a", "Before"), { kind: "media" as const, file }, text("b", "After")],
    ]) {
      const pkg = emptyPackage("Package");
      const round = newRound("Round");
      const q = withQuestionSteps(newQuestion(100, { text: "" }), [{ kind: "main" }, ...rest]);
      round.themes = [newTheme("Theme", [q])];
      pkg.rounds = [round];
      const expected = toParsed(pkg, media).content.rounds[0]!.themes[0]!.questions[0]!;
      const archive = await exportOq(pkg, media);
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(archive);
      });
      const parsed = await parseOq(unzipSync(new Uint8Array(data)));
      const imported = fromUpload(parsed.content);
      const decoded = imported.rounds[0]!.themes[0]!.questions[0]!;
      const published = toParsed(imported, parsed.files).content.rounds[0]!.themes[0]!
        .questions[0]!;
      expect(published.textItems).toEqual(expected.textItems);
      expect(published.questionFiles).toEqual(expected.questionFiles);
      expect(decoded.mainTextFirst).toBe(true);
      expect(questionSteps(decoded)[0]?.kind).toBe("main");
      const withPrompt = toUploadQuestion({ ...decoded, text: "Prompt" }, 0, false);
      expect(withPrompt.textOrder).toBe(0);
    }
  });

  it("preserves absent legacy metadata while new questions use an empty sequence marker", () => {
    const old = newQuestion(100, {
      text: "Caption",
      textPosition: null,
      textItems: undefined,
      questionFiles: [image],
    });
    const oldEncoded = toUploadQuestion(old, 0, false);
    expect(oldEncoded.textOrder).toBeNull();
    expect(oldEncoded).not.toHaveProperty("textItems");
    const fresh = toUploadQuestion(
      newQuestion(100, { text: "First", questionFiles: [image] }),
      0,
      false,
    );
    expect(fresh.textItems).toEqual([]);
    expect(fresh.textOrder).toBe(0);
    expect(fresh.questionFiles?.[0]?.order).toBe(1);
  });

  it("keeps a new text-only prompt sequential after export and import", () => {
    const pkg = emptyPackage("Package");
    const round = newRound("Round");
    round.themes = [newTheme("Theme", [newQuestion(100, { text: "Prompt" })])];
    pkg.rounds = [round];
    const encoded = toUpload(pkg);
    expect(encoded.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      textOrder: 0,
      textItems: [],
    });
    const decoded = fromUpload(encoded).rounds[0]!.themes[0]!.questions[0]!;
    expect(decoded.mainTextFirst).toBe(true);
    const added = { ...decoded, questionFiles: [image] };
    expect(toUploadQuestion(added, 0, false).textOrder).toBe(0);
    expect(toUploadQuestion(added, 0, false).questionFiles?.[0]?.order).toBe(1);
  });

  it("preserves the new main-first setting after an export and import", () => {
    const pkg = emptyPackage("Package");
    const round = newRound("Round");
    round.themes = [
      newTheme("Theme", [newQuestion(100, { text: "Prompt", questionFiles: [image] })]),
    ];
    pkg.rounds = [round];
    const decoded = fromUpload(toUpload(pkg)).rounds[0]!.themes[0]!.questions[0]!;
    expect(decoded.mainTextFirst).toBe(true);
    expect(decoded.textPosition).toBe(0);
    const moved = withQuestionSteps(decoded, [
      { kind: "media", file: decoded.questionFiles[0]! },
      { kind: "main" },
    ]);
    expect(toUploadQuestion(moved, 0, false).textOrder).toBe(0);
  });

  it("keeps text placement through removal, undo and media reordering", () => {
    const base = withQuestionSteps(
      newQuestion(100, { text: "First", questionFiles: [image, audio] }),
      [
        { kind: "main" },
        { kind: "media", file: image },
        text("a", "Middle"),
        { kind: "media", file: audio },
      ],
    );
    const removed = syncQuestionFiles(base, { ...base, questionFiles: [audio] });
    expect(questionSteps(removed).map((item) => item.kind)).toEqual(["main", "text", "media"]);
    const restored = syncQuestionFiles(
      removed,
      { ...removed, questionFiles: [image, audio] },
      questionSteps(base),
    );
    expect(questionSteps(restored).map((item) => item.kind)).toEqual([
      "main",
      "media",
      "text",
      "media",
    ]);
    const moved = syncQuestionFiles(base, { ...base, questionFiles: [audio, image] });
    expect(
      questionSteps(moved).map((item) =>
        item.kind === "media" ? item.file.occurrenceId : item.kind,
      ),
    ).toEqual(["main", "audio", "text", "image"]);
  });

  it("keeps legacy main text between its remaining neighbours after removal and undo", () => {
    const original = newQuestion(100, {
      text: "Main",
      mainTextFirst: undefined,
      textItems: undefined,
      textPosition: 1,
      questionFiles: [image, audio],
    });
    const removed = syncQuestionFiles(original, { ...original, questionFiles: [audio] });
    expect(questionSteps(removed).map((step) => step.kind)).toEqual(["main", "media"]);
    expect(removed.textItems).toBeUndefined();
    const restored = syncQuestionFiles(
      removed,
      { ...removed, questionFiles: [image, audio] },
      questionSteps(original),
    );
    expect(questionSteps(restored).map((step) => step.kind)).toEqual(["media", "main", "media"]);
    expect(restored.textItems).toBeUndefined();
  });

  it("keeps the main text first for newly created questions", () => {
    const fresh = newQuestion(100, { text: "Prompt", questionFiles: [image] });
    const moved = withQuestionSteps(fresh, [
      text("a", "Extra"),
      { kind: "media", file: image },
      { kind: "main" },
    ]);
    const output = toUploadQuestion(moved, 0, false);
    expect(output.textOrder).toBe(0);
    expect(output.textItems?.[0]?.order).toBe(1);
    expect(output.questionFiles?.[0]?.order).toBe(2);
  });

  it("emits text-only extra steps without an empty primary slot", () => {
    const q = newQuestion(100, { textItems: [{ id: "a", text: "Only text", order: 1 }] });
    const result = toUploadQuestion(q, 0, false);
    expect(result.text).toBeNull();
    expect(result.textOrder).toBeNull();
    expect(result.textItems).toEqual([{ order: 0, text: "Only text" }]);
    const issues: string[] = [];
    checkQuestion(
      q,
      false,
      (severity, code) => {
        if (severity === "critical") issues.push(code);
      },
      () => true,
    );
    expect(issues).not.toContain("questionEmpty");
  });
});
