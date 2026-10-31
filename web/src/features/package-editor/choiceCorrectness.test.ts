import { describe, expect, it } from "vitest";
import { parseOq } from "@/features/upload/oq";
import { cloneQuestion } from "./packageOperations";
import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "./packageDraft";
import { validatePackage } from "./validatePackage";
import { editChoiceText, selectChoice } from "./question-form/questionUpdates";

function packageWithChoice() {
  const q = newQuestion(100, {
    type: "choice",
    text: "Question",
    correctChoiceOptionId: "image",
    options: [
      { id: "image", text: "", file: { md5: "picture", type: "image" } },
      { id: "other", text: "Other", file: null },
    ],
  });
  const pkg = emptyPackage("Quiz");
  pkg.rounds = [newRound("Round")];
  pkg.rounds[0]!.themes = [newTheme("Theme", [q])];
  return { pkg, q };
}

describe("authored correct choices", () => {
  it("round-trips a selected image by option identity through reorder and clone", async () => {
    const { pkg, q } = packageWithChoice();
    expect(validatePackage(pkg, () => true).issues.map((issue) => issue.code)).not.toContain(
      "choiceNoCorrect",
    );
    q.options.reverse();
    const exported = toUpload(pkg);
    expect(exported.rounds[0]!.themes[0]!.questions[0]!.correctChoiceOrder).toBe(1);
    const parsed = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(exported)),
    });
    const restored = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
    expect(
      restored.options.find((option) => option.id === restored.correctChoiceOptionId)?.file?.md5,
    ).toBe("picture");
    const copy = cloneQuestion(restored);
    expect(copy.correctChoiceOptionId).not.toBe(restored.correctChoiceOptionId);
    expect(copy.options.find((option) => option.id === copy.correctChoiceOptionId)?.file?.md5).toBe(
      "picture",
    );
  });

  it("leaves legacy answer keys absent and keeps invalid keys unresolved across export", async () => {
    const { pkg, q } = packageWithChoice();
    delete q.correctChoiceOptionId;
    q.answerText = "Other";
    expect(toUpload(pkg).rounds[0]!.themes[0]!.questions[0]).not.toHaveProperty(
      "correctChoiceOrder",
    );
    const legacyNull = toUpload(pkg);
    legacyNull.rounds[0]!.themes[0]!.questions[0]!.correctChoiceOrder = null;
    const nullParsed = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(legacyNull)),
    });
    expect(nullParsed.warnings.map((warning) => warning.code)).not.toContain(
      "choiceCorrectUnresolved",
    );
    expect(
      fromUpload(nullParsed.content).rounds[0]!.themes[0]!.questions[0]!.correctChoiceOptionId,
    ).toBeUndefined();
    const invalid = toUpload(pkg);
    invalid.rounds[0]!.themes[0]!.questions[0]!.correctChoiceOrder = 99;
    const parsed = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(invalid)),
    });
    expect(parsed.warnings.map((warning) => warning.code)).toContain("choiceCorrectUnresolved");
    const draft = fromUpload(parsed.content);
    expect(draft.rounds[0]!.themes[0]!.questions[0]!.correctChoiceOptionId).toBeNull();
    expect(validatePackage(draft, () => true).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "choiceCorrectUnresolved", severity: "critical" }),
      ]),
    );
    expect(toUpload(draft).rounds[0]!.themes[0]!.questions[0]!.correctChoiceNeedsRepair).toBe(true);
    const again = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(toUpload(draft))),
    });
    expect(
      fromUpload(again.content).rounds[0]!.themes[0]!.questions[0]!.correctChoiceOptionId,
    ).toBeNull();
  });

  it("keeps separately authored reveal text when choosing or editing an image choice", () => {
    const { q } = packageWithChoice();
    q.answerText = "Explanation";
    delete q.correctChoiceOptionId;
    const selected = { ...q, ...selectChoice(q, "image") };
    expect(selected.answerText).toBe("Explanation");
    expect(editChoiceText(selected, "image", "Caption").answerText).toBeUndefined();
  });

  it("keeps an incomplete keyed choice editable instead of downgrading away its key", async () => {
    const { pkg, q } = packageWithChoice();
    q.options.pop();
    const archive = toUpload(pkg);
    const parsed = await parseOq({
      "content.json": new TextEncoder().encode(JSON.stringify(archive)),
    });
    const restored = fromUpload(parsed.content);
    const question = restored.rounds[0]!.themes[0]!.questions[0]!;
    expect(question.type).toBe("choice");
    expect(question.correctChoiceOptionId).toBeNull();
    expect(parsed.warnings.map((warning) => warning.code)).toContain("choiceCorrectUnresolved");
    expect(validatePackage(restored, () => true).critical).toBeGreaterThan(0);
  });
});
