import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

export type SimplePackageQuestionDTO = Omit<
  PackageQuestionDTO,
  | "realPrice"
  | "secretRules"
  | "answerExplanation"
  | "answerTextItems"
  | "showmanComments"
  | "script"
  | "answerText"
  | "answerFiles"
  | "answerHint"
  | "answerNumber"
  | "answerPoint"
  | "rightAnswers"
  | "wrongAnswers"
  | "correctChoiceOrder"
  | "selectSource"
> & {
  /** Present only after actual price disclosure; board price stays nominal. */
  realPrice?: number | null;
};
