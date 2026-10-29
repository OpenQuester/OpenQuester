import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

export enum PackageQuestionSubType {
  SIMPLE = "simple",
  CUSTOM_PRICE = "customPrice",
  FOR_EVERYONE = "forEveryone"
}

export interface PackageQuestionDTO {
  id?: number;
  type: PackageQuestionType;
  order: number;
  price: number | null; // Final round questions have null price - players bid after theme selection
  isHidden: boolean;
  text?: string | null;
  /**
   * Position of the text among questionFiles orders. Null keeps the text on
   * screen as a caption for the whole question instead of its own step.
   */
  textOrder?: number | null;
  /** Additional text steps, each identified by its unique content order. */
  textItems?: QuestionTextItemDTO[] | null;
  answerHint?: string | null;
  answerText?: string | null;
  /** How the answer is given and checked; text when missing */
  answerType?: AnswerType | null;
  /** Number answers: the right number; showman only */
  answerNumber?: number | null;
  /** Point answers: the right spot as fractions of the picture; showman only */
  answerPoint?: AnswerPointDTO | null;
  /** Public file order for point answers; absent selects the first question image. */
  pointImageOrder?: number | null;
  /**
   * How far off still counts: an absolute amount for numbers, a fraction of
   * the picture's width for points (0.05 when missing)
   */
  answerDeviation?: number | null;
  /** Other answers that count as right (besides answerText); showman only */
  rightAnswers?: string[] | null;
  /** Answers that are known to be wrong; showman only */
  wrongAnswers?: string[] | null;
  /** Who wrote the question; shown with the answer */
  authors?: string[] | null;
  /** Where the facts come from; shown with the answer */
  sources?: string[] | null;
  answerDelay: number;
  questionComment?: string | null;
  questionFiles?: PackageQuestionFileDTO[] | null;
  answerFiles?: PackageAnswerFileDTO[] | null;
  subType: PackageQuestionSubType;
  showAnswerDuration: number;
  // -- Properties of different question types -- //
  maxPrice?: number | null; // Stake question
  allowedPrices?: number[] | null; // Secret question
  transferType?: PackageQuestionTransferType | null; // Secret question
  priceMultiplier?: number | null; // NoRisk question
  showDelay?: number | null; // Choice question
  answers?: PackageAnswerDTO[] | null; // Choice question
  /** Correct choice's order, when authored; private until reveal. */
  correctChoiceOrder?: number | null;
}

export interface QuestionTextItemDTO {
  order: number;
  text: string;
}

/** A spot on a picture, as fractions (0–1) of its width and height */
export interface AnswerPointDTO {
  x: number;
  y: number;
  /** Oriented first image width divided by height; absent on legacy packages. */
  imageAspectRatio?: number;
}
