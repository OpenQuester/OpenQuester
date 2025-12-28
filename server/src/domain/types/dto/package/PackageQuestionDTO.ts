import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";

export enum PackageQuestionSubType {
  SIMPLE = "simple",
  CUSTOM_PRICE = "customPrice",
  EMPTY = "empty",
  FOR_EVERYONE = "forEveryone",
}

export interface PackageQuestionDTO {
  id?: number;
  type: PackageQuestionType;
  order: number;
  price: number | null; // Final round questions have null price - players bid after theme selection
  isHidden: boolean;
  text?: string | null;
  answerHint?: string | null;
  answerText?: string | null;
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
}
