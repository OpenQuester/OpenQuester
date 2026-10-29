import { describe, expect, it } from "vitest";
import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "./packageDraft";
import { automaticPointTarget, changeMedia } from "./question-form/questionMediaHistory";

const img = (occurrenceId: string, md5 = "same") => ({
  occurrenceId,
  md5,
  type: "image" as const,
  displayTime: 5000,
});
const pack = (q: ReturnType<typeof newQuestion>) => ({
  ...emptyPackage("Q"),
  rounds: [{ ...newRound("R"), themes: [newTheme("T", [q])] }],
});

describe("point image occurrence", () => {
  it("automatically follows the last image and undo restores the legacy target and point", () => {
    const q = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      answerDeviation: 0.05,
      questionFiles: [img("one"), img("two")],
    });
    const add = automaticPointTarget(
      q,
      changeMedia("questionFiles", {
        kind: "add",
        file: img("three"),
      })(q)!,
    );
    expect(add.question).toMatchObject({ pointImageId: "three", answerPoint: null });
    expect(add.undo(add.question)).toMatchObject({
      pointImageId: undefined,
      answerPoint: q.answerPoint,
    });
    const fresh = {
      ...add.question,
      text: "Later edit",
      answerPoint: { x: 0.8, y: 0.8 },
      answerDeviation: 0.4,
    };
    expect(add.undo(fresh).answerPoint).toEqual(q.answerPoint);
    expect(add.undo(fresh)).toMatchObject({ answerDeviation: 0.05, text: "Later edit" });
    const moved = automaticPointTarget(
      q,
      changeMedia("questionFiles", {
        kind: "move",
        occurrenceId: "one",
        destination: 1,
      })(q)!,
    );
    expect(moved.question).toMatchObject({ pointImageId: "one", answerPoint: q.answerPoint });
    expect(moved.undo(moved.question).answerPoint).toEqual(q.answerPoint);
  });

  it("does not change the target when only audio moves or an earlier image is removed", () => {
    const q = newQuestion(100, {
      answerType: "point",
      pointImageId: "two",
      answerPoint: { x: 0.2, y: 0.4 },
      questionFiles: [
        img("one"),
        { occurrenceId: "sound", md5: "sound", type: "audio", displayTime: null },
        img("two"),
      ],
    });
    const removed = automaticPointTarget(
      q,
      changeMedia("questionFiles", {
        kind: "remove",
        index: 0,
        occurrenceId: "one",
      })(q)!,
    );
    const fresh = { ...removed.question, answerPoint: { x: 0.9, y: 0.8 }, answerDeviation: 0.4 };
    expect(removed.undo(fresh).answerPoint).toEqual(fresh.answerPoint);
    expect(removed.undo(fresh).answerDeviation).toBe(0.4);
    const sound = automaticPointTarget(
      q,
      changeMedia("questionFiles", {
        kind: "move",
        occurrenceId: "sound",
        destination: 2,
      })(q)!,
    );
    expect(sound.question).toMatchObject({ pointImageId: "two", answerPoint: q.answerPoint });
  });
  it("keeps legacy first and round-trips a distinct selected duplicate after reorder", () => {
    const legacy = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.1, y: 0.2 },
      questionFiles: [img("one"), img("two")],
    });
    const old = toUpload(pack(legacy));
    expect(old.rounds[0]!.themes[0]!.questions[0]!.pointImageOrder).toBeUndefined();
    expect(
      toUpload(fromUpload(old)).rounds[0]!.themes[0]!.questions[0]!.pointImageOrder,
    ).toBeUndefined();
    const selected = { ...legacy, pointImageId: "two" };
    const moved = changeMedia("questionFiles", {
      kind: "move",
      occurrenceId: "two",
      destination: 0,
    })(selected)!;
    expect(moved.question.answerPoint).toEqual(selected.answerPoint);
    const out = toUpload(pack(moved.question));
    expect(out.rounds[0]!.themes[0]!.questions[0]!.pointImageOrder).toBe(0);
    const imported = fromUpload(out);
    expect(imported.rounds[0]!.themes[0]!.questions[0]!.pointImageId).toBe(
      imported.rounds[0]!.themes[0]!.questions[0]!.questionFiles[0]!.occurrenceId,
    );
    expect(toUpload(imported).rounds[0]!.themes[0]!.questions[0]!.pointImageOrder).toBe(0);
    expect(moved.undo(moved.question).pointImageId).toBe("two");
  });
  it("does not silently resolve an invalid explicit target as first", () => {
    const q = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.5, y: 0.5 },
      pointImageId: "missing",
      questionFiles: [img("one")],
    });
    const out = toUpload(pack(q));
    expect(out.rounds[0]!.themes[0]!.questions[0]!.pointImageOrder).toBe(-1);
    expect(toUpload(fromUpload(out)).rounds[0]!.themes[0]!.questions[0]!.pointImageOrder).toBe(-1);
  });
  it("clears only the removed or geometrically edited selected occurrence and restores on undo", () => {
    const first = img("one", "a"),
      second = img("two", "b");
    const q = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      pointImageId: "two",
      questionFiles: [first, second],
    });
    const unrelated = changeMedia("questionFiles", {
      kind: "remove",
      index: 0,
      occurrenceId: "one",
    })(q)!;
    expect(unrelated.question.answerPoint).toEqual(q.answerPoint);
    expect(unrelated.question.pointImageId).toBe("two");
    const target = changeMedia("questionFiles", { kind: "remove", index: 1, occurrenceId: "two" })(
      q,
    )!;
    expect(target.question.answerPoint).toBeNull();
    expect(target.undo(target.question).answerPoint).toEqual(q.answerPoint);
    const edited = changeMedia("questionFiles", {
      kind: "edit",
      index: 1,
      original: second,
      file: { ...second, md5: "new" },
      geometryChanged: true,
    })(q)!;
    expect(edited.question.answerPoint).toBeNull();
    expect(edited.undo(edited.question).answerPoint).toEqual(q.answerPoint);
  });

  it("does not transfer the old point to a target chosen after deletion or editing", () => {
    const first = img("one", "a");
    const second = img("two", "b");
    const q = newQuestion(100, {
      answerType: "point",
      answerPoint: { x: 0.2, y: 0.4 },
      pointImageId: "one",
      questionFiles: [first, second],
    });
    for (const change of [
      changeMedia("questionFiles", { kind: "remove", index: 0, occurrenceId: "one" })(q)!,
      changeMedia("questionFiles", {
        kind: "edit",
        index: 0,
        original: first,
        file: { ...first, md5: "edited" },
        geometryChanged: true,
      })(q)!,
    ]) {
      for (const point of [null, { x: 0.8, y: 0.9 }]) {
        const restored = change.undo({
          ...change.question,
          pointImageId: "two",
          answerPoint: point,
        });
        expect(restored.pointImageId).toBe("two");
        expect(restored.answerPoint).toEqual(point);
      }
      expect(change.undo(change.question).answerPoint).toEqual(q.answerPoint);
    }
  });
});
