import { answerFormat } from "@/game/answerFormat";
import type { UploadContent, UploadQuestion } from "@/features/upload/types";

/** A stable, locale-independent answer for a finite numeric target. */
export function numericAnswerText(target: number | null | undefined): string | null {
  return target != null && Number.isFinite(target) ? String(target) : null;
}

function withNumericAnswerText(question: UploadQuestion): UploadQuestion {
  const answer =
    answerFormat(question) === "number" ? numericAnswerText(question.answerNumber) : null;
  return answer == null
    ? question
    : { ...question, answerText: answer, rightAnswers: null, wrongAnswers: null };
}

/** Game-facing data omits authoring metadata and text hidden by numeric mode. */
export function playableNumericQuestion(question: UploadQuestion): UploadQuestion {
  if (question.selectSource === undefined && question.compatibilityIssues === undefined) {
    return withNumericAnswerText(question);
  }
  const { selectSource: _source, compatibilityIssues: _issues, ...playable } = question;
  return withNumericAnswerText(playable);
}

/** Project a copy for publication; the draft and its archive retain hidden text. */
export function playableNumericContent(content: UploadContent): UploadContent {
  return {
    ...content,
    rounds: content.rounds.map((round) => ({
      ...round,
      themes: round.themes.map((theme) => ({
        ...theme,
        questions: theme.questions.map(withNumericAnswerText),
      })),
    })),
  };
}
