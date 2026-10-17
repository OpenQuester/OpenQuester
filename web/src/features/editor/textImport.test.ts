import { describe, expect, it } from "vitest";

import { emptyPackage, newRound } from "./model";
import * as ops from "./ops";
import { parseQuestionText } from "./textImport";

describe("parseQuestionText", () => {
  it("reads one theme per block with prices and answers", () => {
    const { themes, missingAnswers } = parseQuestionText(
      [
        "Capitals:",
        "100. The capital of France? | Paris",
        "200) The capital of Japan? — Tokyo",
        "",
        "Planets",
        "The red planet? Answer: Mars",
        "The ringed planet?",
      ].join("\n"),
    );
    expect(themes.map((t) => t.name)).toEqual(["Capitals", "Planets"]);
    expect(themes[0]!.questions.map((q) => [q.price, q.text, q.answerText])).toEqual([
      [100, "The capital of France?", "Paris"],
      [200, "The capital of Japan?", "Tokyo"],
    ]);
    expect(themes[1]!.questions.map((q) => [q.price, q.answerText])).toEqual([
      [100, "Mars"],
      [200, ""],
    ]);
    expect(missingAnswers).toBe(1);
  });
});

describe("editor ops", () => {
  it("sets a round's prices and finds questions", () => {
    const round = newRound("R1");
    let pkg = { ...emptyPackage("P"), rounds: [round] };
    pkg = ops.appendThemes(pkg, round.id, parseQuestionText("T\nA? | Alpha\nB? | Beta").themes);
    pkg = ops.setRoundPrices(pkg, round.id, 50, 25);
    expect(pkg.rounds[0]!.themes[0]!.questions.map((q) => q.price)).toEqual([50, 75]);
    expect(ops.searchQuestions(pkg, "beta").map((h) => h.question.text)).toEqual(["B?"]);
    expect(ops.searchQuestions(pkg, "  ")).toEqual([]);
  });

  it("splits on Russian and Ukrainian answer labels", () => {
    const ru = parseQuestionText("Столицы\nВопрос? Ответ: Москва");
    expect(ru.themes[0]!.questions[0]).toMatchObject({ text: "Вопрос?", answerText: "Москва" });

    const uk = parseQuestionText("Столиці\nПитання? Відповідь: Київ");
    expect(uk.themes[0]!.questions[0]).toMatchObject({ text: "Питання?", answerText: "Київ" });
    expect(uk.missingAnswers).toBe(0);
  });
});
