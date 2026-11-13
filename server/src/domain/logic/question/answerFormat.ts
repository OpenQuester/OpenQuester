import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/** Legacy choice is a select format; the other types retain their own mechanics. */
export function answerFormat(
  question:
    | {
        type: string;
        answerType?: AnswerType | null;
      }
    | null
    | undefined
): AnswerType {
  return question?.type === PackageQuestionType.CHOICE
    ? AnswerType.SELECT
    : (question?.answerType ?? AnswerType.TEXT);
}
