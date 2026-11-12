import type { SecretRoundPrices } from "domain/types/package/SecretRules";
import type { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { TransitionContext } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";

export type QuestionPickPayload = {
  questionId: number;
  secretRoundPrices?: SecretRoundPrices;
  /** Pre-fetched question+theme data from PackageStore, passed to avoid async in canTransition */
  questionData: { question: PackageQuestionDTO; theme: PackageThemeDTO } | null;
};

export type ChoosingToMediaDownloadingCtx = TransitionContext<QuestionPickPayload>;

export interface ChoosingToMediaDownloadingMutationData {
  question: SimplePackageQuestionDTO;
}

// Secret question: CHOOSING -> SECRET_QUESTION_TRANSFER
export type ChoosingToSecretTransferCtx = TransitionContext<QuestionPickPayload>;

export type ChoosingToSecretTransferMutationData = SecretQuestionGameData;

// Stake question: CHOOSING -> STAKE_BIDDING
export type ChoosingToStakeBiddingCtx = TransitionContext<QuestionPickPayload>;

export interface ChoosingToStakeBiddingMutationData {
  pickerPlayerId: number;
  questionId: number;
  maxPrice: number | null;
  /** Actual base price disclosed for bidding; absent on legacy snapshots. */
  questionPrice?: number | null;
  biddingOrder: number[];
  timer: GameStateTimerDTO | undefined;
  automaticBid: PlayerBidData | null;
}

// Fallback when no eligible players for special questions
export type ChoosingToShowingFallbackCtx = TransitionContext<QuestionPickPayload>;
