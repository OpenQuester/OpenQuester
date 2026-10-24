import { describe, expect, it } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { draftFromParsed } from "./createDraft";
import { collectMedia, deleteDraft, loadDraft, loadMedia, saveDraft } from "./draftStorage";
import type { MediaFile } from "@/features/upload/types";
import { emptyPackage } from "./packageDraft";

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
