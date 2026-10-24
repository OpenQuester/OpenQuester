import { describe, expect, it } from "vitest";

import { parseOq } from "@/features/upload/oq";

import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
} from "./packageDraft";
import { validatePackage } from "./validatePackage";

function packageWith(answerType: "number" | "point") {
  const pkg = emptyPackage("Quiz");
  const round = newRound("Round 1");
  const theme = newTheme("Numbers");
  const question = { ...newQuestion(100, { text: "How many?", answerText: "3" }), answerType };
  theme.questions = [question];
  round.themes = [theme];
  pkg.rounds = [round];
  return pkg;
}

describe("number and point answers", () => {
  it("block publishing without the right number, and keep the mode", () => {
    const pkg = packageWith("number");

    const report = validatePackage(pkg, () => true);
    expect(report.issues.map((i) => i.code)).toContain("numberAnswerMissing");
    expect(report.health).toBe("broken");

    const uploaded = toUpload(pkg).rounds[0]!.themes[0]!.questions[0]!;
    expect(uploaded.answerType).toBe("number");
  });

  it("block publishing a point answer without a picture or spot", () => {
    const report = validatePackage(packageWith("point"), () => true);
    expect(report.issues.map((i) => i.code)).toContain("pointAnswerMissing");
  });

  it.each(["number", "point"] as const)(
    "preserves an imported %s mode without its target",
    async (answerType) => {
      const original = toUpload(packageWith(answerType));
      const parsed = await parseOq({
        "content.json": new TextEncoder().encode(JSON.stringify(original)),
      });
      const restored = fromUpload(parsed.content);
      const question = restored.rounds[0]!.themes[0]!.questions[0]!;
      expect(question.answerType).toBe(answerType);
      expect(validatePackage(restored, () => true).critical).toBeGreaterThan(0);
      expect(toUpload(restored).rounds[0]!.themes[0]!.questions[0]!.answerType).toBe(answerType);
    },
  );

  it.each([NaN, Infinity, -Infinity])("blocks a non-finite numeric target (%s)", (answerNumber) => {
    const pkg = packageWith("number");
    pkg.rounds[0]!.themes[0]!.questions[0]!.answerNumber = answerNumber;
    expect(validatePackage(pkg, () => true).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "numberAnswerMissing", severity: "critical" }),
      ]),
    );
  });

  it.each([0, -3.14, 3.14])("accepts the finite numeric target %s", (answerNumber) => {
    const pkg = packageWith("number");
    pkg.rounds[0]!.themes[0]!.questions[0]!.answerNumber = answerNumber;
    expect(validatePackage(pkg, () => true).critical).toBe(0);
    expect(toUpload(pkg).rounds[0]!.themes[0]!.questions[0]!.answerNumber).toBe(answerNumber);
  });

  it.each([
    { x: -0.01, y: 0.5 },
    { x: 0.5, y: 1.01 },
    { x: NaN, y: 0.5 },
    { x: 0.5, y: Infinity },
  ])("blocks a point outside the finite unit square ($x, $y)", (answerPoint) => {
    const pkg = packageWith("point");
    Object.assign(pkg.rounds[0]!.themes[0]!.questions[0]!, {
      answerPoint,
      questionFiles: [{ md5: "a".repeat(32), type: "image", displayTime: null }],
    });
    expect(validatePackage(pkg, () => true).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "pointAnswerMissing", severity: "critical" }),
      ]),
    );
  });

  it.each([
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 0.25, y: 0.75 },
  ])("accepts a picture target at ($x, $y)", (answerPoint) => {
    const pkg = packageWith("point");
    Object.assign(pkg.rounds[0]!.themes[0]!.questions[0]!, {
      answerPoint,
      questionFiles: [{ md5: "a".repeat(32), type: "image", displayTime: null }],
    });
    expect(validatePackage(pkg, () => true).critical).toBe(0);
    expect(toUpload(pkg).rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      answerType: "point",
      answerPoint,
    });
  });
});
