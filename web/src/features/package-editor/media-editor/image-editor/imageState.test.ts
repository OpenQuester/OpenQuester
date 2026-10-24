import { describe, expect, it } from "vitest";
import { initialImageEdits, type ImageAnnotation } from "../mediaEdits";
import { imageHistoryReducer, initialImageHistory } from "./imageHistory";
import { annotationAt, dragAnnotation, imagePoint } from "./imageInteraction";

describe("image editing state", () => {
  it("preserves the undo order, clears redo on a new edit, ignores no-ops and caps history", () => {
    const original = initialImageHistory();
    let history = original;
    for (let rotation = 1; rotation <= 110; rotation++)
      history = imageHistoryReducer(history, {
        type: "commit",
        edits: { ...history.now, rotation },
      });
    expect(history.past).toHaveLength(100);
    expect(history.past[0]!.rotation).toBe(10);
    expect(imageHistoryReducer(history, { type: "commit", edits: { ...history.now } })).toBe(
      history,
    );
    history = imageHistoryReducer(imageHistoryReducer(history, { type: "undo" }), { type: "undo" });
    expect(history.now.rotation).toBe(108);
    expect(history.future.map((entry) => entry.rotation)).toEqual([109, 110]);
    history = imageHistoryReducer(history, { type: "redo" });
    expect(history.now.rotation).toBe(109);
    history = imageHistoryReducer(history, { type: "commit", edits: { ...history.now, blur: 5 } });
    expect(history.future).toEqual([]);
    expect(imageHistoryReducer(history, { type: "redo" })).toBe(history);
    expect(imageHistoryReducer(original, { type: "undo" })).toBe(original);
    expect(original).toEqual(initialImageHistory());
  });

  it("selects the top annotation and drags its shape without mutating the source", () => {
    const annotation: ImageAnnotation = {
      id: "bottom",
      tool: "rectangle",
      points: [
        { x: 0.2, y: 0.3 },
        { x: 0.6, y: 0.8 },
      ],
      color: "#ef4444",
      size: 6,
      text: "",
    };
    const top = { ...annotation, id: "top" };
    const annotations = [annotation, top];
    expect(annotationAt(annotations, { x: 0.4, y: 0.5 })).toBe(top);
    expect(annotationAt(annotations, { x: 0.9, y: 0.1 })).toBeUndefined();
    const moved = dragAnnotation(top, { x: 0.4, y: 0.5 }, { x: 1, y: 0 });
    expect(moved.points[0]!.x).toBeCloseTo(0.6);
    expect(moved.points[0]!.y).toBeCloseTo(0);
    expect(moved.points[1]!.x).toBeCloseTo(1);
    expect(moved.points[1]!.y).toBeCloseTo(0.5);
    expect(annotations.map((item) => item.id)).toEqual(["bottom", "top"]);
    expect(top.points).toEqual([
      { x: 0.2, y: 0.3 },
      { x: 0.6, y: 0.8 },
    ]);
  });

  it("maps a cropped quarter-turn back to source coordinates", () => {
    const edits = {
      ...initialImageEdits(),
      rotation: 90,
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    };
    const point = imagePoint(
      { x: 10, y: 20 },
      { left: 10, top: 20, width: 100, height: 200 },
      { width: 400, height: 200 },
      edits,
    );
    expect(point.x).toBeCloseTo(0.25);
    expect(point.y).toBeCloseTo(0.75);
  });
});
