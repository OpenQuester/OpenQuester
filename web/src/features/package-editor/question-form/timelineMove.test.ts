import { expect, it } from "vitest";
import { newQuestion } from "../packageDraft";
import { questionSteps, withQuestionSteps } from "./questionTimeline";
import { moveTimeline, stepId } from "./timelineMove";

it("moves text and media across one another, then undoes without losing text edits", () => {
  const image = { occurrenceId: "image", md5: "hash", type: "image" as const, displayTime: 1000 };
  const q = withQuestionSteps(newQuestion(100, { text: "Main" }), [
    { kind: "main" },
    { kind: "media", file: image },
    { kind: "text", item: { id: "extra", text: "Old", order: 0 } },
  ]);
  const moved = moveTimeline("text:extra", 1)(q)!;
  expect(questionSteps(moved.question).map(stepId)).toEqual(["main", "text:extra", "media:image"]);
  const edited = {
    ...moved.question,
    textItems: [{ ...moved.question.textItems![0]!, text: "New" }],
  };
  const undone = moved.undo(edited);
  expect(questionSteps(undone).map(stepId)).toEqual(["main", "media:image", "text:extra"]);
  expect(undone.textItems![0]!.text).toBe("New");
  expect(moveTimeline("main", 2)(q)).toBeNull();
  expect(moveTimeline("media:image", 0)(q)).toBeNull();
  const mediaMoved = moveTimeline("media:image", 2)(q)!;
  expect(questionSteps(mediaMoved.question).map(stepId)).toEqual([
    "main",
    "text:extra",
    "media:image",
  ]);
});

it("keeps later edits when both of the moved item's old neighbours are removed", () => {
  const item = (id: string) => ({ kind: "text" as const, item: { id, text: id, order: 0 } });
  const q = withQuestionSteps(newQuestion(100, { mainTextFirst: undefined, textPosition: null }), [
    item("a"),
    item("b"),
    item("c"),
  ]);
  const moved = moveTimeline("text:b", 2)(q)!;
  const later = withQuestionSteps(moved.question, [item("new"), item("b")]);
  const restored = moved.undo(later);
  expect(questionSteps(restored).map(stepId)).toEqual(["text:new", "text:b"]);
  expect(restored.textItems?.map((entry) => entry.text)).toEqual(["new", "b"]);
});
