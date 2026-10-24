import type { ParsedPackage } from "@/features/upload/types";
import { saveDraft } from "./draftStorage";
import { emptyPackage, fromUpload, newId, newRound, starterTheme } from "./packageDraft";

/** Turns an imported file into a draft and returns its id. */
export async function draftFromParsed(parsed: ParsedPackage): Promise<string> {
  const id = newId();
  await saveDraft(
    {
      id,
      pkg: fromUpload(parsed.content),
      updatedAt: Date.now(),
      importWarnings: parsed.warnings,
    },
    parsed.files.values(),
  );
  return id;
}

export async function newDraft(
  title: string,
  roundName: string,
  themeName: string,
): Promise<string> {
  const id = newId();
  const pkg = emptyPackage(title);
  const round = newRound(roundName);
  round.themes = [starterTheme(themeName, 0)];
  pkg.rounds = [round];
  await saveDraft({ id, pkg, updatedAt: Date.now() });
  return id;
}
