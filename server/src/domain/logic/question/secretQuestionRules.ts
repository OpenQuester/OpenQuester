import { PlayerRole } from "domain/types/game/PlayerRole";
import { MAX_QUESTION_PRICE_UPLOAD, MAX_SCORE_DELTA, SCORE_ABS_LIMIT } from "domain/constants/game";
import type { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { getRealPrice, getVisiblePrice } from "domain/logic/question/questionPrices";
import type {
  PublicSecretQuestionGameData,
  SecretQuestionAward,
  SecretQuestionGameData,
  SecretPriceSelectionData
} from "domain/types/dto/game/state/SecretQuestionGameData";
import type { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { customSecretPrices } from "domain/logic/question/secretQuestionPrices";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import type { SecretRoundPrices } from "domain/types/package/SecretRules";
import { ValueUtils } from "domain/utils/ValueUtils";

export function secretRoundPrices(
  questions: Pick<PackageQuestionDTO, "price">[]
): SecretRoundPrices {
  const prices = questions
    .map(getVisiblePrice)
    .filter(
      (price): price is number =>
        price !== null &&
        Number.isSafeInteger(price) &&
        price >= 0 &&
        price <= MAX_QUESTION_PRICE_UPLOAD
    );
  if (!prices.length) {
    throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
  }
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function secretPriceSelection(
  question: PackageQuestionDTO,
  data: SecretQuestionGameData,
  playerId: number
): SecretPriceSelectionData | null {
  const rule = question.secretRules?.priceRule;
  if (rule?.kind === "range") {
    return {
      playerId,
      allowedPrices: [],
      range: { min: rule.min, max: rule.max, step: rule.step }
    };
  }
  if (rule?.kind === "roundExtremes") {
    if (!data.roundPrices) {
      throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
    }
    return { playerId, allowedPrices: [...new Set([data.roundPrices.min, data.roundPrices.max])] };
  }
  const prices = customSecretPrices(question);
  return prices ? { playerId, allowedPrices: prices } : null;
}

export function isAllowedSecretPrice(selection: SecretPriceSelectionData, price: number): boolean {
  if (!Number.isSafeInteger(price) || price < 0 || price > MAX_QUESTION_PRICE_UPLOAD) {
    return false;
  }
  const range = selection.range;
  return range
    ? price >= range.min &&
        price <= range.max &&
        (range.step === 0 || (price - range.min) % range.step === 0)
    : selection.allowedPrices.includes(price);
}

export function announceSecretPrice(
  question: PackageQuestionDTO,
  data: SecretQuestionGameData
): void {
  const selection = secretPriceSelection(question, data, data.pickerPlayerId);
  data.priceRevealed = true;
  data.announcedRange = selection?.range ?? null;
  data.announcedPrices = selection?.allowedPrices ?? null;
  data.announcedPrice = data.realPrice ?? (selection ? null : getRealPrice(question));
}

export function startSecretQuestion(
  question: PackageQuestionDTO,
  pickerPlayerId: number,
  roundPrices?: SecretRoundPrices
): SecretQuestionGameData {
  const data: SecretQuestionGameData = {
    pickerPlayerId,
    questionId: question.id!,
    transferType: question.transferType ?? PackageQuestionTransferType.ANY,
    transferDecisionPhase: true,
    step: "transfer",
    actorPlayerId: pickerPlayerId,
    recipientPlayerId: null,
    priceRevealed: false,
    roundPrices
  };
  if (question.secretRules?.priceAnnouncement === "beforeTransfer") {
    announceSecretPrice(question, data);
    if (question.secretRules.priceChooser === "opener") {
      const selection = secretPriceSelection(question, data, pickerPlayerId);
      if (selection) {
        data.step = "price";
        data.transferDecisionPhase = false;
        data.priceSelection = selection;
      }
    }
  }
  return data;
}

/** Whitelist the public preamble. It never contains outcome, private rules or unrevealed bounds. */
export function projectSecretQuestion(
  data: SecretQuestionGameData | null | undefined
): PublicSecretQuestionGameData | null {
  if (!data) {
    return null;
  }
  return {
    pickerPlayerId: data.pickerPlayerId,
    transferType: data.transferType,
    questionId: data.questionId,
    transferDecisionPhase: data.transferDecisionPhase,
    ...(data.step
      ? {
          step: data.step,
          actorPlayerId: data.actorPlayerId,
          recipientPlayerId: data.recipientPlayerId
        }
      : {}),
    ...(data.priceSelection ? { priceSelection: data.priceSelection } : {}),
    ...(data.priceRevealed
      ? {
          priceRevealed: true,
          announcedPrice: data.realPrice ?? data.announcedPrice ?? null,
          announcedRange: data.announcedRange ?? null,
          announcedPrices: data.announcedPrices ?? null
        }
      : {})
  };
}

/** Score-only result: receiving a bonus is never counted as answering a question. */
export function awardSecretQuestion(
  game: Game,
  question: PackageQuestionDTO,
  recipientPlayerId: number
): SecretQuestionAward {
  const price = game.gameState.secretQuestionData?.realPrice ?? getRealPrice(question);
  const player = game.getPlayer(recipientPlayerId, { fetchDisconnected: true });
  if (
    !player ||
    player.role !== PlayerRole.PLAYER ||
    price === null ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > MAX_QUESTION_PRICE_UPLOAD
  ) {
    throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
  }
  const before = player.score;
  player.score = ValueUtils.clampAbs(
    before + ValueUtils.clampAbs(price, MAX_SCORE_DELTA),
    SCORE_ABS_LIMIT
  );
  return {
    questionId: question.id!,
    recipientPlayerId,
    price,
    appliedChange: player.score - before,
    newScore: player.score,
    reason: "secretAward"
  };
}
