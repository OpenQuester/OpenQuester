import { describe, expect, it } from "@jest/globals";

import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AnswerCheckLogic } from "domain/logic/question/AnswerCheckLogic";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";

function question(extra: Partial<PackageQuestionDTO>): PackageQuestionDTO {
  return {
    type: PackageQuestionType.SIMPLE,
    subType: PackageQuestionSubType.SIMPLE,
    order: 0,
    price: 100,
    answerDelay: 0,
    showAnswerDuration: 5000,
    isHidden: false,
    ...extra
  };
}

describe("AnswerCheckLogic", () => {
  it("checks numbers within the allowed deviation", () => {
    const q = question({ answerType: AnswerType.NUMBER, answerNumber: 1969, answerDeviation: 1 });
    expect(AnswerCheckLogic.check(q, "1969")).toBe(true);
    expect(AnswerCheckLogic.check(q, " 1 970 ")).toBe(true);
    expect(AnswerCheckLogic.check(q, "1972")).toBe(false);
    expect(
      AnswerCheckLogic.check(
        question({ answerType: AnswerType.NUMBER, answerNumber: 3.14 }),
        "3,14"
      )
    ).toBe(true);
  });

  it("leaves a number answer that isn't a number to the showman", () => {
    const q = question({ answerType: AnswerType.NUMBER, answerNumber: 7 });
    expect(AnswerCheckLogic.check(q, "seven")).toBeNull();
  });

  it("checks a point within the radius", () => {
    const q = question({ answerType: AnswerType.POINT, answerPoint: { x: 0.5, y: 0.5 } });
    expect(AnswerCheckLogic.check(q, "0.52,0.48")).toBe(true);
    expect(AnswerCheckLogic.check(q, "0.7,0.5")).toBe(false);
    expect(AnswerCheckLogic.check(q, "not a point")).toBeNull();
  });

  it.each([
    [2, "0.600,0.500", "0.500,0.700", "0.500,0.701"],
    [0.5, "0.600,0.500", "0.500,0.550", "0.500,0.551"],
    [1, "0.600,0.500", "0.500,0.600", "0.500,0.601"]
  ])("checks circular image-space boundaries for aspect %s", (aspect, onX, onY, outside) => {
    const q = question({ answerType: AnswerType.POINT, answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: aspect }, answerDeviation: 0.1 });
    expect(AnswerCheckLogic.check(q, "0.500,0.500")).toBe(true);
    expect(AnswerCheckLogic.check(q, onX)).toBe(true);
    expect(AnswerCheckLogic.check(q, onY)).toBe(true);
    expect(AnswerCheckLogic.check(q, outside)).toBe(false);
  });

  it("keeps legacy point geometry and handles default, zero, and invalid metadata", () => {
    const legacy = question({ answerType: AnswerType.POINT, answerPoint: { x: 0.5, y: 0.5 }, answerDeviation: 0.1 });
    expect(AnswerCheckLogic.check(legacy, "0.500,0.650")).toBe(false);
    const point = question({ answerType: AnswerType.POINT, answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 } });
    expect(AnswerCheckLogic.check(point, "0.500,0.600")).toBe(true);
    expect(AnswerCheckLogic.check({ ...point, answerDeviation: 0 }, "0.500,0.500")).toBe(true);
    expect(AnswerCheckLogic.check({ ...point, answerDeviation: 0 }, "0.501,0.500")).toBe(false);
    expect(AnswerCheckLogic.check({ ...point, answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 0 } }, "0.500,0.500")).toBeNull();
  });

  it("matches zero-radius targets at the wire precision without moving imported targets", () => {
    const q = question({ answerType: AnswerType.POINT, answerPoint: { x: 0.1234, y: 0.5678, imageAspectRatio: 0.5 }, answerDeviation: 0 });
    expect(AnswerCheckLogic.check(q, "0.123,0.568")).toBe(true);
    expect(AnswerCheckLogic.check(q, "0.1234,0.5678")).toBe(true);
    expect(AnswerCheckLogic.check(q, "0.124,0.568")).toBe(false);
    const edge = { ...q, answerPoint: { x: 0, y: 1, imageAspectRatio: 2 } };
    expect(AnswerCheckLogic.check(edge, "0.000,1.000")).toBe(true);
    expect(AnswerCheckLogic.check(edge, "0.001,1.000")).toBe(false);
  });

  it("leaves text answers to the showman", () => {
    expect(AnswerCheckLogic.check(question({ answerText: "Paris" }), "Paris")).toBeNull();
  });
});
