import type { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";
import type { AnswerPointDTO } from "domain/types/dto/package/PackageQuestionDTO";

/** Only answer files are needed to construct their playback timeline. */
export interface AnswerContentSource {
  answerFiles?: PackageAnswerFileDTO[] | null;
}

export interface AnswerRevealDetails {
  rightAnswers: string[] | null;
  authors: string[] | null;
  sources: string[] | null;
  answerPoint: AnswerPointDTO | null;
  answerPointImage: string | null;
  answerDeviation: number | null;
}
