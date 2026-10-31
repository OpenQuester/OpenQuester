import type { GameState, ServerEvent } from "./protocol";
import type { GameSession } from "./reducer";

export type AnswerOutcome = "correct" | "wrong" | "neutral";
export interface QuestionFeedback {
  current: Record<number, AnswerOutcome>;
  previous: Record<number, AnswerOutcome>;
  expiresAt: number | null;
}
export const RESULT_FEEDBACK_MS = 15_000;
const outcome = (correct: boolean | null | undefined, points: number): AnswerOutcome =>
  points === 0 || correct == null ? "neutral" : correct ? "correct" : "wrong";

/** Only published judgments and explicit passes; score administration is not an answer. */
export function questionOutcomes(s: GameState): Record<number, AnswerOutcome> {
  const results: Record<number, AnswerOutcome> = {};
  for (const id of s.skippedPlayers ?? []) results[id] = "neutral";
  for (const answer of s.answeredPlayers ?? [])
    results[answer.player] = outcome(
      answer.answerType === "skip" ? null : answer.answerType === "correct",
      answer.result,
    );
  for (const entry of s.allPlay?.entries ?? [])
    if (entry.scoreChange != null)
      results[entry.playerId] = outcome(entry.isCorrect, entry.scoreChange);
  for (const answer of s.finalRoundData?.answers ?? [])
    if (answer.isCorrect != null || answer.autoLoss)
      results[answer.playerId] = outcome(
        answer.isCorrect ?? false,
        s.finalRoundData?.bids[answer.playerId] ?? 0,
      );
  const last = s.answerShowData?.answerResult;
  if (last)
    results[last.player] = outcome(
      last.answerType === "skip" ? null : last.answerType === "correct",
      last.result,
    );
  return results;
}

export function snapshotFeedback(state: GameState, now: number): QuestionFeedback {
  const results = questionOutcomes(state);
  return state.questionState === "showing_answer"
    ? { current: {}, previous: results, expiresAt: now + RESULT_FEEDBACK_MS }
    : { current: results, previous: {}, expiresAt: null };
}

export function updateQuestionFeedback(
  before: GameSession,
  after: GameSession,
  event: ServerEvent,
  now: number,
): QuestionFeedback {
  const feedback = before.questionFeedback ?? snapshotFeedback(before.state, now);
  if (event.type === "game-data")
    return after.questionFeedback ?? snapshotFeedback(after.state, now);
  if (event.type === "question-finish")
    return {
      current: {},
      previous: {
        ...(before.state.answerShowData ? feedback.previous : {}),
        ...feedback.current,
        ...questionOutcomes(before.state),
        ...questionOutcomes(after.state),
      },
      expiresAt:
        before.state.answerShowData != null && feedback.expiresAt != null
          ? feedback.expiresAt
          : now + RESULT_FEEDBACK_MS,
    };
  if (
    [
      "question-data",
      "all-play-start",
      "secret-question-picked",
      "stake-question-picked",
      "next-round",
      "answer-show-end",
    ].includes(event.type)
  )
    return { ...feedback, current: questionOutcomes(after.state) };
  if (
    [
      "answer-result",
      "answer-result-undo",
      "question-skip",
      "question-unskip",
      "all-play-review",
      "all-play-reviewing",
      "final-answer-review",
      "final-submit-end",
      "final-auto-loss",
    ].includes(event.type)
  ) {
    const current = questionOutcomes(after.state);
    if (after.state.answerShowData && feedback.expiresAt != null) {
      const previous = { ...feedback.previous, ...current };
      if (event.type === "answer-result-undo" && current[event.payload.playerId] == null)
        delete previous[event.payload.playerId];
      return { ...feedback, previous, current: {} };
    }
    return { ...feedback, current };
  }
  return feedback;
}
