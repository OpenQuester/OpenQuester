import { describe, expect, it } from "vitest";
import { newQuestion } from "../packageDraft";
import { changeMedia } from "./questionMediaHistory";

describe("question media history", () => {
  const image = { md5: "same", type: "image" as const, displayTime: 5000 };

  it("restores the removed duplicate at its position without losing other edits", () => {
    const question = newQuestion(100, {
      text: "before",
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      questionFiles: [image, { ...image, displayTime: 7000 }],
    });
    const changed = changeMedia("questionFiles", { kind: "remove", index: 0 })(question)!;
    const later = {
      ...changed.question,
      text: "after",
      questionFiles: [{ ...changed.question.questionFiles[0]!, displayTime: 3000 }],
    };
    const restored = changed.undo(later);
    expect(restored.text).toBe("after");
    expect(restored.questionFiles).toEqual([image, { ...image, displayTime: 3000 }]);
    expect(restored.answerPoint).toEqual(question.answerPoint);
    // A newer point was picked on the next image, so it cannot apply to the restored first image.
    expect(changed.undo({ ...later, answerPoint: { x: 0.8, y: 0.9 } }).answerPoint).toBeNull();
  });

  it("undoes the last batch addition even after its display duration changes", () => {
    const question = newQuestion(100, { answerFiles: [image] });
    const addition = changeMedia("answerFiles", { kind: "add", file: image })(question)!;
    const later = { ...addition.question, answerFiles: [image, { ...image, displayTime: 9000 }] };
    expect(addition.undo(later).answerFiles).toEqual([image]);
  });

  it("clears a point selected on the first added image when that image is undone", () => {
    const question = newQuestion(100, { answerType: "point", questionFiles: [] });
    const added = changeMedia("questionFiles", { kind: "add", file: image })(question)!;
    const selected = { ...added.question, answerPoint: { x: 0.2, y: 0.4 } };
    expect(added.undo(selected)).toMatchObject({ questionFiles: [], answerPoint: null });
  });

  it("keeps the first image's point when undoing an operation on a later image", () => {
    const question = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      questionFiles: [image, { ...image, md5: "second" }],
    });
    const removed = changeMedia("questionFiles", { kind: "remove", index: 1 })(question)!;
    expect(removed.question.answerPoint).toEqual(question.answerPoint);
    expect(removed.undo(removed.question)).toMatchObject({
      questionFiles: question.questionFiles,
      answerPoint: question.answerPoint,
    });
  });

  it("undoes a geometry-changing edit while keeping a later duration", () => {
    const question = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.3, y: 0.6 },
      questionFiles: [image],
    });
    const changed = changeMedia("questionFiles", {
      kind: "edit",
      index: 0,
      original: image,
      file: { ...image, md5: "edited" },
      geometryChanged: true,
    })(question)!;
    expect(changed.question.answerPoint).toBeNull();
    const later = {
      ...changed.question,
      questionFiles: [{ ...changed.question.questionFiles[0]!, displayTime: 1000 }],
    };
    expect(changed.undo(later)).toMatchObject({
      answerPoint: question.answerPoint,
      questionFiles: [{ ...image, displayTime: 1000 }],
    });
    expect(changed.undo({ ...later, answerPoint: { x: 0.8, y: 0.9 } }).answerPoint).toBeNull();
  });
});
