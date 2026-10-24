import { describe, expect, it } from "vitest";

import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  starterTheme,
  toUpload,
} from "./packageDraft";
import * as ops from "./packageOperations";
import { validatePackage } from "./validatePackage";

function sample() {
  let pkg = emptyPackage("Quiz");
  const r1 = newRound("One");
  const r2 = newRound("Two");
  const a = starterTheme("A", 0);
  const b = starterTheme("B", 0);
  const c = starterTheme("C", 1);
  for (const q of [...a.questions, ...b.questions, ...c.questions]) q.text = "Q";
  pkg = ops.addRound(ops.addRound(pkg, r1), r2);
  pkg = ops.addTheme(ops.addTheme(pkg, r1.id, a), r1.id, b);
  pkg = ops.addTheme(pkg, r2.id, c);
  return { pkg, r1, r2, a, b, c };
}

const prices = (pkg: ReturnType<typeof sample>["pkg"], themeId: string) =>
  ops.findTheme(pkg, themeId)!.theme.questions.map((q) => q.price);
const ids = (pkg: ReturnType<typeof sample>["pkg"], themeId: string) =>
  ops.findTheme(pkg, themeId)!.theme.questions.map((q) => q.id);

describe("moveQuestion", () => {
  it("moves a question into a theme of another round", () => {
    const { pkg, a, c } = sample();
    const q = a.questions[1]!;
    const next = ops.moveQuestion(pkg, q.id, c.id, 0);
    expect(ids(next, a.id)).not.toContain(q.id);
    expect(ids(next, c.id)[0]).toBe(q.id);
    // Across themes the question keeps its own price.
    expect(prices(next, c.id)[0]).toBe(200);
  });

  it("reorders inside a theme and keeps the 100–500 price ladder", () => {
    const { pkg, a } = sample();
    const [q1, q2, q3] = a.questions;
    const next = ops.moveQuestion(pkg, q1!.id, a.id, 3, { keepPrices: true });
    expect(ids(next, a.id).slice(0, 3)).toEqual([q2!.id, q3!.id, q1!.id]);
    expect(prices(next, a.id)).toEqual([100, 200, 300, 400, 500]);
  });

  it("returns the same package for a no-op drop", () => {
    const { pkg, a } = sample();
    const q = a.questions[2]!;
    expect(ops.moveQuestion(pkg, q.id, a.id, 2)).toBe(pkg);
    expect(ops.moveQuestion(pkg, q.id, a.id, 3)).toBe(pkg);
  });
});

describe("moveTheme", () => {
  it("moves a theme to another round at a position", () => {
    const { pkg, b, r2, c } = sample();
    const next = ops.moveTheme(pkg, b.id, r2.id, 0);
    expect(ops.findRound(next, r2.id)!.round.themes.map((t) => t.id)).toEqual([b.id, c.id]);
  });

  it("reorders inside a round", () => {
    const { pkg, a, b, r1 } = sample();
    const next = ops.moveTheme(pkg, a.id, r1.id, 2);
    expect(ops.findRound(next, r1.id)!.round.themes.map((t) => t.id)).toEqual([b.id, a.id]);
  });
});

describe("addRound", () => {
  it("keeps the final round last", () => {
    const { pkg } = sample();
    const final = newRound("Final", "final");
    const withFinal = ops.addRound(pkg, final);
    const extra = newRound("Three");
    const next = ops.addRound(withFinal, extra);
    expect(next.rounds.map((r) => r.name)).toEqual(["One", "Two", "Three", "Final"]);
  });
});

describe("upload content", () => {
  it("round-trips through the server shape", () => {
    const { pkg } = sample();
    const content = toUpload(pkg);
    expect(content.rounds[0]!.themes[1]!.questions[4]).toMatchObject({
      order: 4,
      price: 500,
      type: "simple",
    });
    const back = toUpload(fromUpload(content));
    expect(back).toEqual(content);
  });

  it("writes only the fields each question type allows", () => {
    const s = sample();
    const a = s.a;
    let pkg = s.pkg;
    const q = a.questions[0]!;
    pkg = ops.updateQuestion(pkg, q.id, { type: "stake", maxPrice: 900, forEveryone: true });
    const out = toUpload(pkg).rounds[0]!.themes[0]!.questions[0]!;
    expect(out).toMatchObject({ type: "stake", subType: "forEveryone", maxPrice: 900 });
    expect(out).not.toHaveProperty("priceMultiplier");
    expect(out).not.toHaveProperty("answers");
  });

  it("makes final round questions simple with no price", () => {
    let pkg = emptyPackage("Quiz");
    const final = newRound("Final", "final");
    pkg = ops.addRound(pkg, final);
    const theme = starterTheme("F", 0);
    theme.questions = [newQuestion(300, { type: "stake", text: "Q" })];
    pkg = ops.addTheme(pkg, final.id, theme);
    expect(toUpload(pkg).rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      type: "simple",
      price: null,
    });
  });
});

describe("validate", () => {
  it("passes a complete package and flags what blocks publishing", () => {
    const { pkg, a } = sample();
    expect(validatePackage(pkg, () => true).critical).toBe(0);
    const broken = ops.updateQuestion(pkg, a.questions[0]!.id, { text: "" });
    const report = validatePackage(broken, () => true);
    expect(report.health).toBe("broken");
    expect(report.issues[0]).toMatchObject({
      code: "questionEmpty",
      target: { id: a.questions[0]!.id },
    });
    expect(report.byNode.get(a.id)).toBe("critical");
  });

  it("flags a moved question that overfills a final theme", () => {
    const s = sample();
    const a = s.a;
    let pkg = s.pkg;
    const final = newRound("Final", "final");
    pkg = ops.addRound(pkg, final);
    const theme = { ...starterTheme("F", 0), questions: [newQuestion(null, { text: "Q" })] };
    pkg = ops.addTheme(pkg, final.id, theme);
    pkg = ops.moveQuestion(pkg, a.questions[0]!.id, theme.id, 1);
    expect(validatePackage(pkg, () => true).issues.map((i) => i.code)).toContain(
      "finalOneQuestion",
    );
  });
});
