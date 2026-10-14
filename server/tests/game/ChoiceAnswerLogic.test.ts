import { describe, expect, it } from "@jest/globals";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ChoiceAnswerLogic } from "domain/logic/question/ChoiceAnswerLogic";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";

function choice(answerText: string, rightAnswers: string[] | null = null): PackageQuestionDTO {
  return {
    type: PackageQuestionType.CHOICE,
    subType: PackageQuestionSubType.SIMPLE,
    order: 0,
    price: 100,
    answerText,
    rightAnswers,
    answerDelay: 0,
    showAnswerDuration: 5000,
    isHidden: false,
    answers: ["Red", "Green", "Blue"].map((text, order) => ({ text, order, file: null }))
  };
}

describe("ChoiceAnswerLogic", () => {
  it("rules a pick right or wrong against the right answer", () => {
    expect(ChoiceAnswerLogic.check(choice("Green"), " green ")).toBe(true);
    expect(ChoiceAnswerLogic.check(choice("Green"), "Blue")).toBe(false);
  });

  it("also accepts the extra right answers", () => {
    expect(ChoiceAnswerLogic.check(choice("Green", ["Blue"]), "Blue")).toBe(true);
  });

  it("leaves it to the showman when no option is a right answer, or the pick isn't an option", () => {
    expect(ChoiceAnswerLogic.check(choice("Purple"), "Blue")).toBeNull();
    expect(ChoiceAnswerLogic.check(choice("Green"), "Yellow")).toBeNull();
  });
});
