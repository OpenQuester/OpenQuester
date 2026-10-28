import type { UploadContent, UploadQuestion } from "@/features/upload/types";

/** A stable, locale-independent answer for a finite numeric target. */
export function numericAnswerText(target: number | null | undefined): string | null {
  return target != null && Number.isFinite(target) ? String(target) : null;
}

/** Game-facing data omits text answers hidden by the numeric authoring mode. */
export function playableNumericQuestion(question: UploadQuestion): UploadQuestion {
  const answer =
    question.answerType === "number" && question.type !== "choice"
      ? numericAnswerText(question.answerNumber)
      : null;
  return answer == null
    ? question
    : { ...question, answerText: answer, rightAnswers: null, wrongAnswers: null };
}

/** Project a copy for publication; the draft and its archive retain hidden text. */
export function playableNumericContent(content: UploadContent): UploadContent {
  return {
    ...content,
    rounds: content.rounds.map((round) => ({
      ...round,
      themes: round.themes.map((theme) => ({
        ...theme,
        questions: theme.questions.map(playableNumericQuestion),
      })),
    })),
  };
}
