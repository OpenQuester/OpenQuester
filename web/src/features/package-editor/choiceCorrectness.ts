import type { DraftQuestion } from "./packageDraft";

/** The explicitly selected option, or an unambiguous legacy text match. */
export function correctChoice(q: DraftQuestion) {
  if (q.correctChoiceOptionId !== undefined) {
    return q.options.find((option) => option.id === q.correctChoiceOptionId);
  }
  const text = q.answerText.trim();
  const matches = q.options.filter((option) => text && option.text.trim() === text);
  return matches.length === 1 ? matches[0] : undefined;
}
