import { AnswerType } from "domain/enums/package/AnswerType";
import { answerFormat } from "domain/logic/question/answerFormat";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import type { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

export function questionMediaFiles(
  question: PackageQuestionDTO | null | undefined
): PackageQuestionFileDTO[] {
  return [
    ...(question?.questionFiles ?? []),
    ...(answerFormat(question) === AnswerType.SELECT
      ? (question?.answers ?? []).flatMap((option) =>
          option.file ? [{ file: option.file, order: option.order, displayTime: null }] : []
        )
      : [])
  ];
}
