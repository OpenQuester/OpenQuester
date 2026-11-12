import { MAX_QUESTION_PRICE_UPLOAD } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import {
  type PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";

/** The existing legacy price list, shared by transfers and automatic fallbacks. */
export function customSecretPrices(question: PackageQuestionDTO): number[] | null {
  if (question.secretRules || question.subType !== PackageQuestionSubType.CUSTOM_PRICE) {
    return null;
  }

  const prices = [...new Set(question.allowedPrices ?? [])].sort((a, b) => a - b);
  if (
    !prices.length ||
    prices.some(
      (price) => !Number.isSafeInteger(price) || price < 0 || price > MAX_QUESTION_PRICE_UPLOAD
    )
  ) {
    throw new ClientError(ClientResponse.INVALID_INPUT);
  }

  return prices;
}

/** An automatic fallback resolves the lowest offered price on a live copy only. */
export function resolveSecretFallbackPrice(question: PackageQuestionDTO): PackageQuestionDTO {
  if (question.type !== PackageQuestionType.SECRET) {
    return question;
  }

  const prices = customSecretPrices(question);
  return prices ? { ...question, realPrice: prices[0] } : question;
}
