import { fireEvent, render, screen } from "@testing-library/react";
import { unzipSync, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import { fromUpload } from "@/features/package-editor/packageDraft";
import { exportOq, toParsed } from "@/features/package-editor/packageMedia";
import { QuestionPlaytest } from "@/features/package-editor/playtest/QuestionPlaytest";
import { validatePackage } from "@/features/package-editor/validatePackage";
import { scriptReferenceIssue, type QuestionScriptStep } from "@/game/questionScript";
import { md5Hex } from "./archive";
import { parseOq } from "./oq";
import { assertPlayableCompatibility, scriptRepairDetail } from "./siqCompatibility";
import type { ParsedPackage, UploadQuestion } from "./types";
import { readPackageFile, uploadPackage } from "./upload";

const questionContent = {
  op: "showContent",
  phase: "question",
  orders: [0],
} satisfies QuestionScriptStep;
const answerContent = {
  op: "showContent",
  phase: "answer",
  orders: [0, 9],
} satisfies QuestionScriptStep;
const select = {
  op: "setAnswerType",
  answerType: "select",
  optionOrders: [0, 4],
  correctChoiceOrder: 0,
} satisfies QuestionScriptStep;
const point = { op: "setAnswerType", answerType: "point" } as const;
const ask = { op: "askAnswer", mode: "direct", durationMs: null } as const;
const right = {
  op: "showContent",
  phase: "answer",
  orders: [],
  revealRight: true,
} satisfies QuestionScriptStep;
const bytes = new Uint8Array([11, 12, 13]);
const image = { md5: md5Hex(bytes), type: "image" } as const;

function question(
  steps: QuestionScriptStep[] = [questionContent, select, ask, answerContent],
  fields: Partial<UploadQuestion> = {},
): UploadQuestion {
  return {
    type: "simple",
    order: 0,
    price: 100,
    showAnswerDuration: 5000,
    textItems: [{ order: 0, text: "Prompt" }],
    answerFiles: [{ order: 9, file: image, displayTime: null }],
    answers: [
      { order: 0, text: "Right", file: null },
      { order: 4, text: "Other", file: null },
    ],
    script: { version: 1, steps, answerTextItems: [{ order: 0, text: "Explanation" }] },
    ...fields,
  };
}

function entries(source: UploadQuestion) {
  return {
    "content.json": new TextEncoder().encode(
      JSON.stringify({
        title: "Scripts",
        rounds: [{ name: "Round", themes: [{ name: "Theme", questions: [source] }] }],
      }),
    ),
    [`files/${image.md5}`]: bytes,
  };
}

const first = ({ content }: ParsedPackage) => content.rounds[0]!.themes[0]!.questions[0]!;
const archiveFile = (source: UploadQuestion) =>
  new File([new Uint8Array(zipSync(entries(source)))], "script.oq");

describe("browser parity with validateQuestionScript", () => {
  it("resolves separate order spaces, including archived answer text fallback and key zero", () => {
    expect(scriptReferenceIssue(question())).toBeUndefined();
    expect(scriptReferenceIssue(question(undefined, { answerTextItems: [] }))).toContain(
      "answer content order 0 matches 0 items",
    );
  });

  it.each([
    [
      "empty content orders",
      [{ ...questionContent, orders: [] }],
      {},
      "missing question content orders",
    ],
    [
      "duplicate content orders",
      [{ ...questionContent, orders: [0, 0] }],
      {},
      "duplicate question content orders",
    ],
    [
      "wrong phase",
      [{ ...questionContent, orders: [9] }],
      {},
      "question content order 9 matches 0 items",
    ],
    [
      "ambiguous content order",
      [{ ...answerContent, orders: [9] }],
      { answerTextItems: [{ order: 9, text: "Tie" }] },
      "answer content order 9 matches 2 items",
    ],
    ["missing options", [{ ...select, optionOrders: undefined }], {}, "optionOrders needs"],
    ["duplicate orders", [{ ...select, optionOrders: [0, 0] }], {}, "optionOrders needs"],
    [
      "missing key",
      [{ ...select, correctChoiceOrder: null }],
      {},
      "correctChoiceOrder must be in optionOrders",
    ],
    [
      "missing option",
      [{ ...select, optionOrders: [0, 8] }],
      {},
      "option order 8 matches 0 choices",
    ],
    [
      "ambiguous option",
      [select],
      {
        answers: [
          { order: 0, text: "First", file: null },
          { order: 0, text: "Second", file: null },
          { order: 4, text: "Other", file: null },
        ],
      },
      "option order 0 matches 2 choices",
    ],
    ["missing number", [{ op: "setAnswerType", answerType: "number" }], {}, "answerNumber"],
    [
      "non-finite number",
      [{ op: "setAnswerType", answerType: "number" }],
      { answerNumber: Infinity },
      "answerNumber",
    ],
    ["missing point", [point], {}, "missing answerPoint"],
    ["point without image", [point, ask], { answerPoint: { x: 0, y: 0 } }, "step 2 (askAnswer)"],
    [
      "text reveal clears image",
      [{ ...answerContent, orders: [9] }, right, point, ask],
      { answerPoint: { x: 0, y: 0 } },
      "step 4 (askAnswer)",
    ],
    [
      "text trails image",
      [{ ...answerContent, orders: [0, 9] }, point, ask],
      {
        answerTextItems: [{ order: 9, text: "Tail" }],
        answerFiles: [{ order: 0, file: image, displayTime: null }],
        answerPoint: { x: 0, y: 0 },
      },
      "step 3 (askAnswer)",
    ],
  ] satisfies [string, QuestionScriptStep[], Partial<UploadQuestion>, string][])(
    "rejects %s",
    (_name, steps, fields, detail) => {
      expect(scriptReferenceIssue(question(steps, fields))).toContain(detail);
    },
  );

  it("retains the active image across a point reveal and accepts numeric zero", () => {
    expect(
      scriptReferenceIssue(
        question(
          [
            { ...answerContent, orders: [9, 0] },
            point,
            right,
            ask,
            { op: "setAnswerType", answerType: "number" },
          ],
          { answerPoint: { x: 0, y: 0 }, answerNumber: 0 },
        ),
      ),
    ).toBeUndefined();
  });

  it.each(["question", "answer"] as const)(
    "checks expanded %s limits at their boundaries",
    (phase) => {
      const repeats = (length: number) =>
        question(Array.from({ length }, () => ({ op: "showContent", phase, orders: [0] })));
      expect(scriptRepairDetail(repeats(30))).toBeUndefined();
      expect(scriptRepairDetail(repeats(31))).toBe(`${phase}: 31 groups (maximum 30)`);
      const together = (length: number) => {
        const files = Array.from({ length }, (_, order) => ({
          order: order + 1,
          file: image,
          displayTime: null,
          waitForFinish: false,
        }));
        return question(
          [{ op: "showContent", phase, orders: files.map(({ order }) => order) }],
          phase === "question" ? { questionFiles: files } : { answerFiles: files },
        );
      };
      expect(scriptRepairDetail(together(10))).toBeUndefined();
      expect(scriptRepairDetail(together(11))).toBe(`${phase} group 1: 11 files (maximum 10)`);
    },
  );
});

it("round-trips a valid .oq script with sparse orders and answer text fallback", async () => {
  const source = question();
  const imported = await parseOq(entries(source));
  const draft = fromUpload(imported.content);
  const archive = await exportOq(draft, imported.files);
  const restored = await parseOq(unzipSync(new Uint8Array(await archive.arrayBuffer())));
  for (const parsed of [imported, restored]) {
    expect(parsed.warnings).toEqual([]);
    expect(first(parsed)).toMatchObject({
      script: source.script,
      answers: source.answers,
      answerFiles: source.answerFiles,
    });
    expect(() => assertPlayableCompatibility(parsed.content)).not.toThrow();
    expect(
      validatePackage(fromUpload(parsed.content), (md5) => parsed.files.has(md5)).critical,
    ).toBe(0);
  }
});

it.each([
  [
    [{ ...questionContent, orders: [900] }, select, ask],
    "step 1 (showContent): question content order 900 matches 0 items",
  ],
  [
    [{ ...select, correctChoiceOrder: 1 }, ask],
    "step 1 (setAnswerType): correctChoiceOrder must be in optionOrders",
  ],
] satisfies [QuestionScriptStep[], string][])(
  "retains a broken .oq script and blocks publication and playtest",
  async (steps, detail) => {
    const source = question(steps);
    const imported = await readPackageFile(archiveFile(source));
    const draft = fromUpload(imported.content);
    const q = draft.rounds[0]!.themes[0]!.questions[0]!;
    const archive = await exportOq(draft, imported.files);
    const restored = await parseOq(unzipSync(new Uint8Array(await archive.arrayBuffer())));
    for (const parsed of [imported, restored]) {
      expect(first(parsed).script).toEqual(source.script);
      expect(parsed.warnings).toEqual([
        {
          code: "siqCompatibility",
          where: "Round › Theme › 100",
          severity: "critical",
          resolution: "needsRepair",
          detail,
        },
      ]);
    }
    const report = validatePackage(draft, (md5) => imported.files.has(md5));
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "scriptRepair",
        severity: "critical",
        target: expect.objectContaining({ id: q.id }),
        args: { detail },
      }),
    );
    const progress = vi.fn();
    await expect(uploadPackage(toParsed(draft, imported.files), progress)).rejects.toThrow(
      "compatibilityNeedsRepair",
    );
    expect(progress).not.toHaveBeenCalled();
    const onFix = vi.fn();
    render(
      <QuestionPlaytest
        question={q}
        final={false}
        themeName="Theme"
        media={imported.files}
        canSave
        onFix={onFix}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(detail);
    fireEvent.click(screen.getByRole("button"));
    expect(onFix).toHaveBeenCalledWith("#qf-compatibility button");
  },
);

const repeatedContent = Array.from({ length: 31 }, () => questionContent);

it("rejects over-limit expanded script content at .oq archive preflight", async () => {
  await expect(readPackageFile(archiveFile(question(repeatedContent)))).rejects.toMatchObject({
    message: "contentLimits",
    issues: [{ round: "Round", theme: "Theme", number: 1, phase: "question", actual: 31, max: 30 }],
  });
});

it("keeps expanded content limits active on existing drafts", async () => {
  const parsed = await parseOq(entries(question()));
  const draft = fromUpload(parsed.content);
  const q = draft.rounds[0]!.themes[0]!.questions[0]!;
  q.script = { version: 1, steps: repeatedContent };
  expect(() => assertPlayableCompatibility(toParsed(draft, parsed.files).content)).toThrow(
    "compatibilityNeedsRepair",
  );
  expect(validatePackage(draft, () => true).issues).toContainEqual(
    expect.objectContaining({ code: "contentStepLimit", severity: "critical" }),
  );
});
