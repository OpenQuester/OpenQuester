import { describe, expect, it } from "@jest/globals";

import { FinalAnswerType } from "domain/enums/FinalRoundTypes";
import { type FinalRoundAnswer } from "domain/types/finalround/FinalRoundInterfaces";
import { type AnswerReviewData } from "domain/types/socket/finalround/FinalRoundResults";
import {
  expectFinalReviews,
  expectPersistedFinalAnswers,
  type FinalReviewExpectation
} from "tests/socket/game/utils/FinalRoundTestAssertions";

const expected: readonly FinalReviewExpectation[] = [
  {
    playerId: 1,
    answerText: "Manual answer",
    isCorrect: null,
    answerType: FinalAnswerType.PENDING
  },
  { playerId: 2, answerText: "", isCorrect: false, answerType: FinalAnswerType.AUTO_LOSS },
  { playerId: 3, answerText: "", isCorrect: false, answerType: FinalAnswerType.AUTO_LOSS }
];

function correctReviews(): AnswerReviewData[] {
  return expected.map((review) => ({
    ...review,
    answerId: String(review.playerId),
    scoreChange: 0
  }));
}

function correctAnswers(): FinalRoundAnswer[] {
  return expected.map(({ playerId, answerText, isCorrect, answerType }) => ({
    id: String(playerId),
    playerId,
    answer: answerText,
    ...(isCorrect === null ? {} : { isCorrect }),
    autoLoss: answerType === FinalAnswerType.AUTO_LOSS,
    submittedAt: new Date(0)
  }));
}

describe("exact final-round assertions", () => {
  it("accepts the complete correct flow regardless of record order", () => {
    expectFinalReviews(correctReviews().reverse(), expected);
    expectPersistedFinalAnswers(correctAnswers().reverse(), expected);
  });

  it("rejects duplicated manual text that arrayContaining accepts as two empty answers", () => {
    const reviews = correctReviews();
    reviews[1].answerText = "Manual answer";
    expect(reviews.map(({ answerText }) => answerText)).toEqual(
      expect.arrayContaining(["Manual answer", "", ""])
    );
    expect(() => expectFinalReviews(reviews, expected)).toThrow();
  });

  it("rejects manual text assigned to a timed-out player", () => {
    const reviews = correctReviews();
    reviews[0].answerText = "";
    reviews[1].answerText = "Manual answer";
    expect(() => expectFinalReviews(reviews, expected)).toThrow();
  });

  it("rejects duplicated player identities and missing records", () => {
    const reviews = correctReviews();
    reviews[2].playerId = 2;
    expect(() => expectFinalReviews(reviews, expected)).toThrow();
    expect(() => expectFinalReviews(correctReviews().slice(0, 2), expected)).toThrow();
    expect(() => expectFinalReviews(undefined, expected)).toThrow();
  });

  it("rejects incorrect timeout result metadata", () => {
    const reviews = correctReviews();
    reviews[1].isCorrect = true;
    expect(() => expectFinalReviews(reviews, expected)).toThrow();
    reviews[1].isCorrect = false;
    reviews[1].answerType = FinalAnswerType.PENDING;
    expect(() => expectFinalReviews(reviews, expected)).toThrow();
  });

  it("rejects corrupted persisted answer text independently of correct broadcasts", () => {
    expectFinalReviews(correctReviews(), expected);
    const answers = correctAnswers();
    answers[1].answer = "Manual answer";
    expect(() => expectPersistedFinalAnswers(answers, expected)).toThrow();
  });

  it("rejects corrupt persisted player/result records", () => {
    const answers = correctAnswers();
    answers[2].playerId = 2;
    expect(() => expectPersistedFinalAnswers(answers, expected)).toThrow();
    const wrongResult = correctAnswers();
    wrongResult[1].autoLoss = false;
    expect(() => expectPersistedFinalAnswers(wrongResult, expected)).toThrow();
    expect(() => expectPersistedFinalAnswers(undefined, expected)).toThrow();
  });

  it("rejects malformed persisted auto-loss flags instead of normalizing them to false", () => {
    for (const autoLoss of ["false", 0, null]) {
      const answers = correctAnswers();
      answers[0] = { ...answers[0], autoLoss } as unknown as FinalRoundAnswer;
      expect(() => expectPersistedFinalAnswers(answers, expected)).toThrow();
    }
  });
});
