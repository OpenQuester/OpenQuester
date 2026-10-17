import { describe, expect, it } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { draftFromParsed } from "./EditorHomePage";
import { collectMedia, loadDraft, loadMedia, putMedia } from "./drafts";
import type { MediaFile } from "@/features/upload/types";

describe("drafts made from an imported file", () => {
  it("keep the import report until it is dismissed", async () => {
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
  it("keeps media written for a draft that is not saved yet", async () => {
    const file = {
      md5: "f".repeat(32),
      type: "image" as const,
      bytes: new Uint8Array([1, 2, 3]),
      name: "a.png",
    } as unknown as MediaFile;
    await putMedia([file]);

    // Another draft is deleted before the new one is saved
    await collectMedia();

    expect((await loadMedia([file.md5])).has(file.md5)).toBe(true);
  });
});
