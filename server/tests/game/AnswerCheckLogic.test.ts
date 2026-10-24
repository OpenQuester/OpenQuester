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

  it("leaves text answers to the showman", () => {
    expect(AnswerCheckLogic.check(question({ answerText: "Paris" }), "Paris")).toBeNull();
  });
});
