import { describe, expect, it } from "@jest/globals";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ChoiceAnswerLogic } from "domain/logic/question/ChoiceAnswerLogic";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
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

  it("uses the explicit key before the main text and preserves extra aliases", () => {
    const q = choice("Green");
    q.answers![0].text = "Green";
    q.correctChoiceOrder = 0;
    expect(ChoiceAnswerLogic.check(q, "Green", 0, true)).toBe(true);
    expect(ChoiceAnswerLogic.check(q, "Green", 1, true)).toBe(false);
    q.rightAnswers = ["green"];
    expect(ChoiceAnswerLogic.check(q, "Green", 1, true)).toBe(true);
    q.correctChoiceOrder = 99;
    expect(ChoiceAnswerLogic.check(q, "Green", 1, true)).toBeNull();
    q.correctChoiceOrder = 0.5;
    q.answers![0].order = 0.5;
    expect(ChoiceAnswerLogic.check(q, "Green", 0.5, true)).toBeNull();
  });

  it("checks keyed image choices and narrowly guards legacy numeric collisions", () => {
    const q = choice("1");
    q.answers = [
      { order: 0, text: null, file: { md5: "image", type: PackageFileType.IMAGE } },
      { order: 1, text: "1", file: null },
      { order: 2, text: "42", file: null }
    ];
    q.correctChoiceOrder = 0;
    expect(ChoiceAnswerLogic.check(q, "#1", 0, true)).toBe(true);
    expect(ChoiceAnswerLogic.check(q, "1", 1, true)).toBe(false);
    delete q.correctChoiceOrder;
    expect(ChoiceAnswerLogic.check(q, "1")).toBeNull();
    expect(ChoiceAnswerLogic.check(q, "1", 1, true)).toBe(true);
    expect(ChoiceAnswerLogic.check(q, "42")).toBe(false);
    expect(ChoiceAnswerLogic.check(q, "#1", 0, true)).toBeNull();
  });

  it("retains a correct image for reveal without replacing authored answer media", () => {
    const q = choice("Explanation");
    q.correctChoiceOrder = 0;
    q.answers![0] = {
      order: 0,
      text: null,
      file: { md5: "image", type: PackageFileType.IMAGE, link: "https://x/image" }
    };
    expect(ShowAnswerLogic.revealDetails(q).correctChoiceImage).toBe("https://x/image");
    q.answerFiles = [
      {
        order: 0,
        displayTime: 5000,
        file: { md5: "other", type: PackageFileType.IMAGE, link: "https://x/other" }
      }
    ];
    expect(ShowAnswerLogic.revealDetails(q).correctChoiceImage).toBeNull();
    expect(ShowAnswerLogic.buildAnswerPlan(q)?.totalMs).toBe(5000);
    expect(q.answerText).toBe("Explanation");
  });
});
