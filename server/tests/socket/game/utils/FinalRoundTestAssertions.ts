import { expect } from "@jest/globals";

import { FinalAnswerType } from "domain/enums/FinalRoundTypes";
import { type FinalRoundAnswer } from "domain/types/finalround/FinalRoundInterfaces";
import { type AnswerReviewData } from "domain/types/socket/finalround/FinalRoundResults";

export type FinalReviewExpectation = Pick<
  AnswerReviewData,
  "playerId" | "answerText" | "isCorrect" | "answerType"
>;

/** Compare complete per-player records; arrayContaining does not count duplicate answers. */
export function expectFinalReviews(
  reviews: readonly AnswerReviewData[] | undefined,
  expected: readonly FinalReviewExpectation[]
): void {
  expect(
    reviews
      ?.map(({ playerId, answerText, isCorrect, answerType }) => ({
        playerId,
        answerText,
        isCorrect,
        answerType
      }))
      .sort(byPlayerId)
  ).toEqual([...expected].sort(byPlayerId));
}

export function expectPersistedFinalAnswers(
  answers: readonly FinalRoundAnswer[] | undefined,
  expected: readonly FinalReviewExpectation[]
): void {
  expect(
    answers
      ?.map(({ playerId, answer, isCorrect, autoLoss }) => ({
        playerId,
        answer,
        isCorrect: isCorrect ?? null,
        autoLoss: autoLoss === undefined ? false : autoLoss
      }))
      .sort(byPlayerId)
  ).toEqual(
    expected
      .map(({ playerId, answerText, isCorrect, answerType }) => ({
        playerId,
        answer: answerText,
        isCorrect,
        autoLoss: answerType === FinalAnswerType.AUTO_LOSS
      }))
      .sort(byPlayerId)
  );
}

function byPlayerId(left: { playerId: number }, right: { playerId: number }): number {
  return left.playerId - right.playerId;
}
