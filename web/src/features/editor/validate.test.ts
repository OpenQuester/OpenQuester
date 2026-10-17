import { describe, expect, it } from "vitest";

import { emptyPackage, newQuestion, newRound, newTheme, toUpload } from "./model";
import { validate } from "./validate";

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

    const report = validate(pkg, () => true);
    expect(report.issues.map((i) => i.code)).toContain("numberAnswerMissing");
    expect(report.health).toBe("broken");

    const uploaded = toUpload(pkg).rounds[0]!.themes[0]!.questions[0]!;
    expect(uploaded.answerType).toBe("number");
  });

  it("block publishing a point answer without a picture or spot", () => {
    const report = validate(packageWith("point"), () => true);
    expect(report.issues.map((i) => i.code)).toContain("pointAnswerMissing");
  });
});
