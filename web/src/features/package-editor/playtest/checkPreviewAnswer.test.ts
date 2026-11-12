import { expect, it } from "vitest";
import { question } from "@/game/fixtures";
import { checkPreviewAnswer } from "./checkPreviewAnswer";

it.each([
  [2, 2, 0.05, "0.540,0.500", false],
  [1, 2, 0.05, "0.540,0.500", true],
  [1, 2, 0.05, "0.500,0.560", false],
  [0.5, 2, 0.05, "0.590,0.500", true],
  [2, 0.5, 0, "0.509,0.500", true],
  [2, 0.5, 0, "0.511,0.500", false],
  [1, 2, null, "0.530,0.500", false],
])(
  "checks SIQ source aspect %s independently of measured aspect %s (A13–A15)",
  (sourceAspect, actualAspect, deviation, picked, expected) => {
    const q = question(1, {
      answerType: "point",
      answerDeviation: deviation,
      answerPoint: {
        x: 0.5,
        y: 0.5,
        imageAspectRatio: actualAspect,
        sourceGeometry: { kind: "sigame", aspectRatio: sourceAspect },
      },
    });
    expect(checkPreviewAnswer(q, picked)).toBe(expected);
  },
);
it("retains native radius, zero, and default behavior (A28)", () => {
  const q = question(1, {
    answerType: "point",
    answerDeviation: 0.05,
    answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
  });
  expect(checkPreviewAnswer(q, "0.540,0.500")).toBe(true);
  expect(checkPreviewAnswer({ ...q, answerDeviation: null }, "0.540,0.500")).toBe(true);
  expect(checkPreviewAnswer({ ...q, answerDeviation: 0 }, "0.501,0.500")).toBe(false);
});
