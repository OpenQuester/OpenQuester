import { describe, expect, it } from "@jest/globals";

import {
  CONTENT_IMAGE_TIME,
  CONTENT_ITEM_MAX_TIME,
  CONTENT_MEDIA_UNKNOWN_TIME,
  CONTENT_TEXT_MIN_TIME,
  SHOW_ANSWER_DURATION_TEXT,
  SHOW_ANSWER_DURATION_VIDEO
} from "domain/constants/game";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { QuestionContentItemKind } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

function file(
  order: number,
  type: PackageFileType,
  extra: Partial<PackageQuestionFileDTO> = {}
): PackageQuestionFileDTO {
  return {
    order,
    displayTime: null,
    file: { md5: `md5-${order}`, type },
    ...extra
  };
}

describe("QuestionContentPlanLogic", () => {
  it("plays text, then each video, one step at a time", () => {
    const plan = QuestionContentPlanLogic.build(
      {
        text: "Name the film",
        textOrder: 0,
        files: [file(1, PackageFileType.VIDEO), file(2, PackageFileType.VIDEO)]
      },
      { "md5-1": 12_000, "md5-2": 8_000 }
    )!;

    expect(plan.steps.map((s) => s.items.map((i) => i.kind))).toEqual([
      [QuestionContentItemKind.TEXT],
      [QuestionContentItemKind.FILE],
      [QuestionContentItemKind.FILE]
    ]);
    expect(plan.steps.map((s) => [s.startMs, s.durationMs])).toEqual([
      [0, CONTENT_TEXT_MIN_TIME],
      [CONTENT_TEXT_MIN_TIME, 12_000],
      [CONTENT_TEXT_MIN_TIME + 12_000, 8_000]
    ]);
    expect(plan.totalMs).toBe(CONTENT_TEXT_MIN_TIME + 20_000);
  });

  it("sequences additional text between media without changing the main text order", () => {
    const plan = QuestionContentPlanLogic.build({
      text: "Main question",
      textOrder: 0,
      textItems: [
        { order: 2, text: "Extra prompt" },
        { order: 4, text: "Last prompt" }
      ],
      files: [file(3, PackageFileType.VIDEO, { displayTime: 4000 }), file(1, PackageFileType.IMAGE)]
    })!;
    expect(plan.steps.map((step) => [step.items[0].kind, step.items[0].order])).toEqual([
      [QuestionContentItemKind.TEXT, 0],
      [QuestionContentItemKind.FILE, 1],
      [QuestionContentItemKind.TEXT, 2],
      [QuestionContentItemKind.FILE, 3],
      [QuestionContentItemKind.TEXT, 4]
    ]);
    expect(plan.steps.map((step) => step.durationMs)).toEqual([2000, 5000, 2000, 4000, 2000]);
    expect(plan.totalMs).toBe(15000);
  });

  it("sequences one additional text without a main question or files", () => {
    const plan = QuestionContentPlanLogic.build({ textItems: [{ order: 0, text: "Only step" }] });
    expect(plan).toMatchObject({
      totalMs: CONTENT_TEXT_MIN_TIME,
      steps: [{ items: [{ kind: "text", order: 0 }] }]
    });
  });

  it("keeps a text without textOrder as a caption, not a step", () => {
    const plan = QuestionContentPlanLogic.build({
      text: "Who is this?",
      textOrder: null,
      files: [file(0, PackageFileType.IMAGE)]
    })!;

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].items[0].kind).toBe(QuestionContentItemKind.FILE);
    expect(plan.totalMs).toBe(CONTENT_IMAGE_TIME);
  });

  it("returns null when there is nothing to sequence", () => {
    expect(QuestionContentPlanLogic.build({ text: "Only text" })).toBeNull();
  });

  it("sorts by order and puts the text first on a tie", () => {
    const plan = QuestionContentPlanLogic.build({
      text: "Look",
      textOrder: 1,
      files: [file(1, PackageFileType.IMAGE), file(0, PackageFileType.IMAGE)]
    })!;

    expect(plan.steps.map((s) => `${s.items[0].kind}:${s.items[0].order}`)).toEqual([
      "file:0",
      "text:1",
      "file:1"
    ]);
  });

  it("groups items until one waits for its finish", () => {
    const plan = QuestionContentPlanLogic.build({
      files: [
        file(0, PackageFileType.IMAGE, { waitForFinish: false, displayTime: 3_000 }),
        file(1, PackageFileType.IMAGE, { displayTime: 7_000 }),
        file(2, PackageFileType.IMAGE)
      ]
    })!;

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].items.map((i) => i.order)).toEqual([0, 1]);
    expect(plan.steps[0].durationMs).toBe(7_000);
    expect(plan.steps[1].startMs).toBe(7_000);
  });

  it("does not let a non-waiting background sound stretch its step", () => {
    const plan = QuestionContentPlanLogic.build(
      {
        files: [
          file(0, PackageFileType.AUDIO, {
            placement: ContentPlacement.BACKGROUND,
            waitForFinish: false
          }),
          file(1, PackageFileType.IMAGE)
        ]
      },
      { "md5-0": 60_000 }
    )!;

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].durationMs).toBe(CONTENT_IMAGE_TIME);
    expect(plan.steps[0].items[0]).toMatchObject({
      placement: ContentPlacement.BACKGROUND,
      durationMs: 60_000
    });
  });

  it("treats a background placement on non-audio files as screen", () => {
    const plan = QuestionContentPlanLogic.build({
      files: [file(0, PackageFileType.IMAGE, { placement: ContentPlacement.BACKGROUND })]
    })!;

    expect(plan.steps[0].items[0].placement).toBe(ContentPlacement.SCREEN);
  });

  it("prefers displayTime, then reported length, then the default, capped", () => {
    const plan = QuestionContentPlanLogic.build(
      {
        files: [
          file(0, PackageFileType.VIDEO, { displayTime: 4_000 }),
          file(1, PackageFileType.VIDEO),
          file(2, PackageFileType.AUDIO),
          file(3, PackageFileType.VIDEO, { displayTime: 10 * 60_000 })
        ]
      },
      { "md5-0": 50_000, "md5-1": 9_000 }
    )!;

    expect(plan.steps.map((s) => s.durationMs)).toEqual([
      4_000,
      9_000,
      CONTENT_MEDIA_UNKNOWN_TIME,
      CONTENT_ITEM_MAX_TIME
    ]);
  });
});

describe("ShowAnswerLogic answer plan", () => {
  it("sequences answer files with the answer defaults", () => {
    const question = {
      answerFiles: [file(0, PackageFileType.IMAGE), file(1, PackageFileType.VIDEO)]
    };

    const plan = ShowAnswerLogic.buildAnswerPlan(question)!;

    expect(plan.steps.map((s) => s.durationMs)).toEqual([
      SHOW_ANSWER_DURATION_TEXT,
      SHOW_ANSWER_DURATION_VIDEO
    ]);
    expect(plan.totalMs).toBe(SHOW_ANSWER_DURATION_TEXT + SHOW_ANSWER_DURATION_VIDEO);
  });

  it("has no plan without answer files", () => {
    expect(ShowAnswerLogic.buildAnswerPlan({ answerFiles: null })).toBeNull();
  });
});

describe("point answer reveal image", () => {
  it("selects the first question image by order without changing the original array", () => {
    const files = [
      file(3, PackageFileType.IMAGE, {
        file: { md5: "later", type: PackageFileType.IMAGE, link: "/later" }
      }),
      file(0, PackageFileType.AUDIO),
      file(1, PackageFileType.IMAGE, {
        file: { md5: "first", type: PackageFileType.IMAGE, link: "/first" }
      })
    ];
    const question = {
      type: PackageQuestionType.SIMPLE,
      subType: PackageQuestionSubType.SIMPLE,
      order: 0,
      price: 100,
      isHidden: false,
      answerDelay: 0,
      showAnswerDuration: 5000,
      answerType: AnswerType.POINT,
      questionFiles: files
    };
    expect(ShowAnswerLogic.revealDetails(question).answerPointImage).toBe("/first");
    expect(files.map((item) => item.order)).toEqual([3, 0, 1]);
    expect(
      ShowAnswerLogic.revealDetails({ ...question, answerType: AnswerType.TEXT }).answerPointImage
    ).toBeNull();
    expect(
      ShowAnswerLogic.revealDetails({ ...question, questionFiles: [] }).answerPointImage
    ).toBeNull();
    expect(
      ShowAnswerLogic.revealDetails({
        ...question,
        questionFiles: [file(0, PackageFileType.IMAGE)]
      }).answerPointImage
    ).toBeNull();
  });

  it("uses an explicit image order and fails closed for a missing or ambiguous target", () => {
    const question = {
      type: PackageQuestionType.SIMPLE,
      subType: PackageQuestionSubType.SIMPLE,
      order: 0,
      price: 100,
      isHidden: false,
      answerDelay: 0,
      showAnswerDuration: 5000,
      answerType: AnswerType.POINT,
      pointImageOrder: 3,
      questionFiles: [
        file(1, PackageFileType.IMAGE, {
          file: { md5: "first", type: PackageFileType.IMAGE, link: "/first" }
        }),
        file(3, PackageFileType.IMAGE, {
          file: { md5: "last", type: PackageFileType.IMAGE, link: "/last" }
        })
      ]
    };
    expect(ShowAnswerLogic.revealDetails(question).answerPointImage).toBe("/last");
    expect(
      ShowAnswerLogic.revealDetails({ ...question, pointImageOrder: null }).answerPointImage
    ).toBe("/first");
    expect(
      ShowAnswerLogic.revealDetails({ ...question, pointImageOrder: 5 }).answerPointImage
    ).toBeNull();
    expect(
      ShowAnswerLogic.revealDetails({
        ...question,
        questionFiles: [...question.questionFiles, file(3, PackageFileType.AUDIO)]
      }).answerPointImage
    ).toBeNull();
  });
});
