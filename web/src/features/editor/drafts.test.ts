import { describe, expect, it } from "vitest";

import type { ParsedPackage } from "@/features/upload/types";

import { draftFromParsed } from "./EditorHomePage";
import { loadDraft } from "./drafts";

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
