import { answerFormat } from "./answerFormat";
import type { Question, QuestionFile } from "./protocol";

/** Option media preloads with the question but does not become authored content steps. */
export function questionMediaFiles(question: Question | null | undefined): QuestionFile[] {
  return [
    ...(question?.questionFiles ?? []),
    ...(answerFormat(question) === "select"
      ? (question?.answers ?? []).flatMap((option) =>
          option.file ? [{ file: option.file, order: option.order, displayTime: null }] : [],
        )
      : []),
  ];
}
