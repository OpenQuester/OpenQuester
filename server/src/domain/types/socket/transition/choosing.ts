import { TransitionContext } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";

export type QuestionPickPayload = {
  questionId: number;
};

export type ChoosingToMediaDownloadingCtx =
  TransitionContext<QuestionPickPayload>;

export interface ChoosingToMediaDownloadingMutationData {
  question: SimplePackageQuestionDTO;
}

// Secret question: CHOOSING -> SECRET_QUESTION_TRANSFER
export type ChoosingToSecretTransferCtx =
  TransitionContext<QuestionPickPayload>;

export interface ChoosingToSecretTransferMutationData {
  pickerPlayerId: number;
  questionId: number;
  transferType: PackageQuestionTransferType;
  transferDecisionPhase: boolean;
}

// Stake question: CHOOSING -> STAKE_BIDDING
export type ChoosingToStakeBiddingCtx = TransitionContext<QuestionPickPayload>;

export interface ChoosingToStakeBiddingMutationData {
  pickerPlayerId: number;
  questionId: number;
  maxPrice: number | null;
  biddingOrder: number[];
  timer: GameStateTimerDTO | undefined;
  automaticBid: PlayerBidData | null;
}

// Fallback when no eligible players for special questions
export type ChoosingToShowingFallbackCtx =
  TransitionContext<QuestionPickPayload>;

export interface ChoosingToShowingFallbackMutationData {
  question: SimplePackageQuestionDTO;
  originalQuestionType: PackageQuestionType;
}
