import { describe, expect, it } from "vitest";

import {
  createDocument,
  useEditorStore,
  validateDocument,
} from "./editorStore";

describe("editor package validation", () => {
  it("blocks publishing empty questions", () => {
    const issues = validateDocument(createDocument());
    expect(issues.some((issue) => issue.severity === "critical")).toBe(true);
  });

  it("moves and reorders questions across themes", () => {
    const document = createDocument();
    const round = document.rounds[0]!;
    const source = round.themes[0]!;
    const target = round.themes[1]!;
    const moved = source.questions[0]!;
    useEditorStore.getState().replace(document);

    useEditorStore
      .getState()
      .moveQuestion(moved.id, round.id, target.id, target.questions[1]!.id);

    const updatedRound = useEditorStore.getState().document.rounds[0]!;
    expect(updatedRound.themes[0]!.questions).toHaveLength(4);
    expect(updatedRound.themes[1]!.questions[1]!.id).toBe(moved.id);
    expect(updatedRound.themes[1]!.questions.map((item) => item.order)).toEqual(
      [0, 1, 2, 3, 4, 5],
    );
  });

  it("accepts a complete minimal package", () => {
    const document = createDocument();
    document.title = "A complete package";
    for (const round of document.rounds) {
      for (const theme of round.themes) {
        for (const question of theme.questions) {
          question.text = "Question";
          question.answer = "Answer";
        }
      }
    }
    expect(
      validateDocument(document).filter(
        (issue) => issue.severity === "critical",
      ),
    ).toHaveLength(0);
  });
});
