import type { PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import type { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";
import type {
  AnswerPointDTO,
  QuestionTextItemDTO
} from "domain/types/dto/package/PackageQuestionDTO";

/** Authored reveal text and files, independent of checking answers. */
export interface AnswerContentSource {
  playMediaSimultaneously?: boolean | null;
  answerFiles?: PackageAnswerFileDTO[] | null;
  answerTextItems?: QuestionTextItemDTO[] | null;
}

export interface AnswerRevealDetails {
  answerTextItems: QuestionTextItemDTO[] | null;
  answerExplanation: string | null;
  rightAnswers: string[] | null;
  authors: string[] | null;
  sources: string[] | null;
  answerPoint: AnswerPointDTO | null;
  answerPointImage: string | null;
  answerDeviation: number | null;
  correctChoiceImage: string | null;
  correctChoice: PackageAnswerDTO | null;
}
