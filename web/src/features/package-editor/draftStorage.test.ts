import { describe, expect, it } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { draftFromParsed } from "./createDraft";
import { collectMedia, deleteDraft, loadDraft, loadMedia, saveDraft } from "./draftStorage";
import type { MediaFile } from "@/features/upload/types";
import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
  fromUpload,
} from "./packageDraft";

describe("drafts made from an imported file", () => {
  it("keep the original import report", async () => {
    const parsed: ParsedPackage = {
      format: "siq",
      content: {
        title: "Imported",
        ageRestriction: "NONE",
        tags: [],
        rounds: [],
      } as unknown as ParsedPackage["content"],
      files: new Map(),
      warnings: [{ code: "choiceAsSimple", where: "Round 1 · Cities · 100" }],
    };

    const id = await draftFromParsed(parsed);

    expect((await loadDraft(id))?.importWarnings).toEqual(parsed.warnings);
  });
});

describe("media cleanup", () => {
  it("keeps shared media until its last referencing draft is deleted", async () => {
    const file = {
      md5: "f".repeat(32),
      type: "image" as const,
      bytes: new Uint8Array([1, 2, 3]),
      name: "a.png",
    } as unknown as MediaFile;
    const pkg = { ...emptyPackage("Shared"), logo: { md5: file.md5, type: "image" as const } };
    await saveDraft({ id: "first", pkg, updatedAt: 1 }, [file]);
    await saveDraft({ id: "second", pkg, updatedAt: 2 });
    await deleteDraft("first");
    await collectMedia();
    expect((await loadMedia([file.md5])).has(file.md5)).toBe(true);
    await deleteDraft("second");
    expect((await loadMedia([file.md5])).has(file.md5)).toBe(false);
  });
});

it("autosaves source geometry and explicit duplicate occurrence without converting the metric (A11/A14/A17)", async () => {
  const pkg = emptyPackage("Point");
  const q = newQuestion(100, {
    answerType: "point",
    pointImageId: "last",
    answerPoint: { x: 0.5, y: 0.5, sourceGeometry: { kind: "sigame", aspectRatio: 1 } },
    questionFiles: [
      { occurrenceId: "first", md5: "same", type: "image", displayTime: null },
      { occurrenceId: "last", md5: "same", type: "image", displayTime: null },
    ],
  });
  pkg.rounds = [{ ...newRound("Round"), themes: [newTheme("Theme", [q])] }];
  await saveDraft({ id: "siq-point", pkg, updatedAt: 1 }, [
    { md5: "same", type: "image", name: "point.png", bytes: new Uint8Array([1]) },
  ]);
  const restored = await loadDraft("siq-point");
  const again = fromUpload(toUpload(restored!.pkg)).rounds[0]!.themes[0]!.questions[0]!;
  expect(again.answerPoint).toEqual(q.answerPoint);
  expect(again.pointImageId).toBe(again.questionFiles[1]!.occurrenceId);
  await deleteDraft("siq-point");
});
