import { describe, expect, it } from "vitest";
import {
  missingScriptPointImageStep,
  readQuestionScript,
  type QuestionScriptDTO,
} from "./questionScript";

const program = (step: unknown) => ({ version: 1, steps: [step] });
const range = { min: 100, max: 300, step: 0 };

describe("archived question scripts", () => {
  it("accepts all typed step forms and returns an independent copy", () => {
    const value = {
      version: 1,
      steps: [
        { op: "setTheme" },
        { op: "setAnswerType", answerType: "select", optionOrders: [0, 1], correctChoiceOrder: 1 },
        { op: "showContent", phase: "question", orders: [0] },
        { op: "askAnswer", mode: "button", durationMs: null },
        { op: "setAnswerer", mode: "all" },
        { op: "setAnswerer", mode: "byCurrent", select: "any" },
        { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "visible" },
        { op: "setAnswerer", mode: "stake", select: "allPossible", stakeVisibility: "hidden" },
        { op: "announcePrice", range },
        { op: "setPrice", mode: "select", range },
        { op: "setPrice", mode: "noRisk" },
        { op: "showContent", phase: "answer", orders: [], revealRight: true },
        { op: "accept" },
      ],
      answerTextItems: [
        { order: 0, text: "", durationMs: 120_000, waitForFinish: false, placement: "replic" },
      ],
    };
    const parsed = readQuestionScript(value);
    expect(parsed).toEqual(value);
    expect(parsed?.steps[0]).not.toBe(value.steps[0]);
    expect(readQuestionScript(null)).toBeNull();
  });

  it("checks an answer-phase image against the archived text orders when no override exists", () => {
    const script: QuestionScriptDTO = {
      version: 1,
      steps: [
        { op: "setAnswerType", answerType: "point" },
        { op: "showContent", phase: "answer", orders: [0] },
        { op: "askAnswer", mode: "direct", durationMs: null },
      ],
      answerTextItems: [{ order: 0, text: "Conflicting order" }],
    };
    const answerFiles = [
      { order: 0, displayTime: null, file: { type: "image" as const, md5: "map" } },
    ];
    expect(missingScriptPointImageStep({ script, answerFiles })).toBe(2);
    expect(missingScriptPointImageStep({ script, answerFiles, answerTextItems: [] })).toBe(-1);
  });

  it.each([
    ["missing step", null],
    ["unknown operation", { op: "unsupported" }],
    ["inherited name", { op: "toString" }],
    ["unknown key", { op: "accept", target: 2 }],
    ["wrong answer format", { op: "setAnswerType", answerType: "image" }],
    ["non-string answer format", { op: "setAnswerType", answerType: ["text"] }],
    [
      "non-integer option order",
      { op: "setAnswerType", answerType: "select", optionOrders: [0, 1.5] },
    ],
    ["negative key", { op: "setAnswerType", answerType: "select", correctChoiceOrder: -1 }],
    ["non-string content phase", { op: "showContent", phase: ["answer"], orders: [] }],
    ["non-array content orders", { op: "showContent", phase: "question", orders: "0" }],
    ["non-boolean reveal", { op: "showContent", phase: "answer", orders: [], revealRight: 1 }],
    ["zero duration", { op: "askAnswer", mode: "direct", durationMs: 0 }],
    ["oversized duration", { op: "askAnswer", mode: "direct", durationMs: 86_400_001 }],
    ["non-string ask mode", { op: "askAnswer", mode: ["direct"], durationMs: null }],
    [
      "mismatched stake visibility",
      { op: "setAnswerer", mode: "stake", select: "highest", stakeVisibility: "hidden" },
    ],
    ["non-string answerer mode", { op: "setAnswerer", mode: ["all"] }],
    ["non-string transfer selection", { op: "setAnswerer", mode: "byCurrent", select: ["any"] }],
    ["descending range", { op: "announcePrice", range: { ...range, min: 500 } }],
    ["fractional range", { op: "setPrice", mode: "select", range: { ...range, step: 0.5 } }],
    ["range on fixed multiplier", { op: "setPrice", mode: "noRisk", range }],
    ["non-string price mode", { op: "setPrice", mode: ["multiply"] }],
  ])("rejects %s", (_name, step) => {
    expect(() => readQuestionScript(program(step))).toThrow("badQuestionScript");
  });

  it.each([
    ["no version", { steps: [{ op: "accept" }] }],
    ["empty steps", { version: 1, steps: [] }],
    [
      "too many steps",
      { version: 1, steps: Array.from({ length: 129 }, () => ({ op: "accept" })) },
    ],
    ["unknown top-level property", { ...program({ op: "accept" }), extra: 1 }],
    ["non-array answer text", { ...program({ op: "accept" }), answerTextItems: {} }],
    [
      "empty untimed answer text",
      { ...program({ op: "accept" }), answerTextItems: [{ order: 0, text: " ", durationMs: 0 }] },
    ],
    [
      "invalid placement",
      {
        ...program({ op: "accept" }),
        answerTextItems: [{ order: 0, text: "Reply", placement: "background" }],
      },
    ],
  ])("rejects an archive with %s", (_name, value) => {
    expect(() => readQuestionScript(value)).toThrow("badQuestionScript");
  });
});
