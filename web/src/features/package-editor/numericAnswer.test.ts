// @vitest-environment node
import { unzipSync } from "fflate";
import { expect, it } from "vitest";

import { parseOq } from "@/features/upload/oq";
import {
  emptyPackage,
  fromUpload,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
  toUploadQuestion,
} from "./packageDraft";
import { exportOq } from "./packageMedia";
import {
  numericAnswerText,
  playableNumericContent,
  playableNumericQuestion,
} from "./numericAnswer";
import { previewQuestion } from "./playtest/previewModel";
import { validatePackage } from "./validatePackage";

it.each([0, -12.5, 1e-7])(
  "projects numeric target %s for play without mutating the draft or archive",
  async (target) => {
    const question = newQuestion(100, {
      text: "Question",
      answerType: "number",
      answerNumber: target,
      answerDeviation: 0.25,
      answerText: "Hidden answer",
      rightAnswers: ["Hidden right"],
      wrongAnswers: ["Hidden wrong"],
      answerHint: "Hint",
    });
    const pkg = {
      ...emptyPackage("Numbers"),
      rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [question])] }],
    };
    const original = toUpload(pkg);
    const projected = playableNumericContent(original);
    expect(projected.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      answerType: "number",
      answerNumber: target,
      answerDeviation: 0.25,
      answerText: String(target),
      rightAnswers: null,
      wrongAnswers: null,
      answerHint: "Hint",
    });
    expect(original.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
      answerText: "Hidden answer",
      rightAnswers: ["Hidden right"],
      wrongAnswers: ["Hidden wrong"],
    });
    expect(previewQuestion(question, false, new Map())).toMatchObject({
      answerText: String(target),
      rightAnswers: null,
      wrongAnswers: null,
    });
    const parsed = await parseOq(
      unzipSync(new Uint8Array(await (await exportOq(pkg, new Map())).arrayBuffer())),
    );
    const restored = fromUpload(parsed.content).rounds[0]!.themes[0]!.questions[0]!;
    expect(restored).toMatchObject({
      answerNumber: target,
      answerText: "Hidden answer",
      rightAnswers: ["Hidden right"],
      wrongAnswers: ["Hidden wrong"],
    });
    expect(question.answerText).toBe("Hidden answer");
  },
);

it("respects choice and effective final mode, and leaves invalid numeric targets untouched", () => {
  const draft = newQuestion(100, {
    type: "choice",
    answerType: "number",
    answerNumber: 42,
    answerText: "Option",
  });
  const choice = toUploadQuestion(draft, 0, false);
  expect(playableNumericQuestion(choice)).toBe(choice);
  expect(playableNumericQuestion(toUploadQuestion(draft, 0, true))).toMatchObject({
    type: "simple",
    answerText: "42",
    answerNumber: 42,
  });
  expect(previewQuestion(draft, true, new Map())).toMatchObject({
    type: "simple",
    answerText: "42",
    answerNumber: 42,
  });
  const invalid = { ...toUploadQuestion(draft, 0, true), answerNumber: Infinity };
  expect(playableNumericQuestion(invalid)).toBe(invalid);
  expect(numericAnswerText(null)).toBeNull();
});

it("validates the numeric target without hidden text warnings", () => {
  const q = newQuestion(100, {
    text: "Question",
    answerType: "number",
    answerNumber: 0,
    answerText: "x".repeat(20000),
  });
  const pkg = {
    ...emptyPackage("Numbers"),
    rounds: [{ ...newRound("Round"), themes: [newTheme("Theme", [q])] }],
  };
  const codes = () => validatePackage(pkg, () => true).issues.map((issue) => issue.code);
  expect(codes()).not.toContain("noAnswer");
  expect(codes()).not.toContain("longText");
  q.answerNumber = null;
  expect(codes()).toContain("numberAnswerMissing");
  q.text = "x".repeat(20000);
  expect(codes()).toContain("longText");
});
