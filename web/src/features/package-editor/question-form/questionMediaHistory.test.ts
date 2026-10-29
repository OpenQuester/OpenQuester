import { describe, expect, it } from "vitest";
import { newQuestion, toUploadQuestion } from "../packageDraft";
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

  it("moves duplicate occurrences without swapping their settings and preserves later edits on undo", () => {
    const first = { ...image, occurrenceId: "one", displayTime: 1000 };
    const second = { ...image, occurrenceId: "two", displayTime: 2000, waitForFinish: false };
    const sound = {
      md5: "sound",
      occurrenceId: "sound",
      type: "audio" as const,
      displayTime: null,
      placement: "background" as const,
    };
    const question = newQuestion(100, {
      text: "Prompt",
      textPosition: 1,
      mainTextFirst: undefined,
      questionFiles: [first, sound, second],
      answerPoint: { x: 0.2, y: 0.4 },
    });
    const moved = changeMedia("questionFiles", {
      kind: "move",
      occurrenceId: "two",
      destination: 0,
    })(question)!;
    expect(moved.question.questionFiles.map((file) => file.occurrenceId)).toEqual([
      "two",
      "one",
      "sound",
    ]);
    expect(moved.question.answerPoint).toEqual(question.answerPoint);
    expect(moved.question.textPosition).toBe(1);
    const later = {
      ...moved.question,
      text: "Changed",
      questionFiles: moved.question.questionFiles.map((file) =>
        file.occurrenceId === "two" ? { ...file, displayTime: 9000 } : file,
      ),
    };
    const restored = moved.undo(later);
    expect(restored.text).toBe("Changed");
    expect(restored.textPosition).toBe(1);
    expect(restored.questionFiles.map((file) => file.occurrenceId)).toEqual([
      "one",
      "sound",
      "two",
    ]);
    expect(restored.questionFiles[2]).toMatchObject({ displayTime: 9000, waitForFinish: false });
    expect(restored.questionFiles[1]).toMatchObject({ placement: "background" });
  });

  it("clears the point when the first image changes and undo restores only its original target", () => {
    const first = { ...image, md5: "a", occurrenceId: "a" };
    const second = { ...image, md5: "b", occurrenceId: "b" };
    const question = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      questionFiles: [first, second],
    });
    const moved = changeMedia("questionFiles", { kind: "move", occurrenceId: "a", destination: 1 })(
      question,
    )!;
    expect(moved.question.answerPoint).toBeNull();
    expect(moved.undo(moved.question).answerPoint).toEqual(question.answerPoint);
    expect(
      moved.undo({ ...moved.question, answerPoint: { x: 0.9, y: 0.9 } }).answerPoint,
    ).toBeNull();
  });

  it("resolves delayed edits and removals by occurrence even after reorder", () => {
    const first = { ...image, occurrenceId: "one", displayTime: 1000 };
    const second = { ...image, occurrenceId: "two", displayTime: 2000 };
    const question = newQuestion(100, { questionFiles: [first, second] });
    const moved = changeMedia("questionFiles", {
      kind: "move",
      occurrenceId: "one",
      destination: 1,
    })(question)!;
    const edited = changeMedia("questionFiles", {
      kind: "edit",
      index: 1,
      original: second,
      file: { ...second, md5: "edited" },
      geometryChanged: false,
    })(moved.question)!;
    expect(edited.question.questionFiles.map((file) => file.md5)).toEqual(["edited", "same"]);
    const removed = changeMedia("questionFiles", { kind: "remove", index: 0, occurrenceId: "one" })(
      edited.question,
    )!;
    expect(removed.question.questionFiles.map((file) => file.occurrenceId)).toEqual(["two"]);
  });

  it("does not apply a move if its confirmed target or point changed while queued", () => {
    const question = newQuestion(100, {
      questionFiles: [
        { ...image, occurrenceId: "one" },
        { ...image, md5: "b", occurrenceId: "two" },
      ],
    });
    const move = changeMedia("questionFiles", {
      kind: "move",
      occurrenceId: "one",
      destination: 1,
      expectedImage: "same",
      expectedPoint: null,
    });
    expect(move({ ...question, answerPoint: { x: 0.1, y: 0.2 } })).toBeNull();
  });

  it("keeps the text slot and omits editor occurrence IDs from the package contract", () => {
    const question = newQuestion(100, {
      text: "Prompt",
      textPosition: 1,
      mainTextFirst: undefined,
      questionFiles: [
        { ...image, occurrenceId: "one" },
        { ...image, occurrenceId: "two" },
      ],
    });
    const moved = changeMedia("questionFiles", {
      kind: "move",
      occurrenceId: "two",
      destination: 0,
    })(question)!;
    const output = toUploadQuestion(moved.question, 0, false);
    expect(output.textOrder).toBe(1);
    expect(output.questionFiles?.map((file) => file.order)).toEqual([0, 2]);
    expect(output.questionFiles?.every((file) => !("occurrenceId" in file))).toBe(true);
  });

  it("undoes answer media reorder without clearing a question point set afterwards", () => {
    const first = { ...image, occurrenceId: "one" };
    const second = { ...image, md5: "other", occurrenceId: "two" };
    const question = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      answerFiles: [first, second],
    });
    const moved = changeMedia("answerFiles", {
      kind: "move",
      occurrenceId: "one",
      destination: 1,
    })(question)!;
    const later = { ...moved.question, answerPoint: { x: 0.7, y: 0.8 } };
    expect(moved.undo(later)).toMatchObject({
      answerPoint: { x: 0.7, y: 0.8 },
      answerFiles: [first, second],
    });
  });
});
