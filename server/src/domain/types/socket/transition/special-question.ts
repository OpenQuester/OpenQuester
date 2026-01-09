import { TransitionContext } from "domain/state-machine/types";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";

// ============================================================================
// SECRET TRANSFER → ANSWERING
// ============================================================================

/**
 * Payload for SECRET_QUESTION_TRANSFER → ANSWERING transition.
 */
export type SecretTransferToAnsweringPayload = {
  targetPlayerId: number;
};

export type SecretTransferToAnsweringCtx =
  TransitionContext<SecretTransferToAnsweringPayload>;

export interface SecretTransferToAnsweringMutationData {
  fromPlayerId: number;
  targetPlayerId: number;
  questionId: number;
  questionData: SimplePackageQuestionDTO | null;
}

// ============================================================================
// STAKE BIDDING → SHOWING
// ============================================================================

/**
 * Payload for STAKE_BIDDING → SHOWING transition (bidding complete).
 */
export type StakeBiddingToAnsweringPayload = {
  isPhaseComplete: boolean;
  winnerPlayerId: number | null;
  finalBid: number | null;
};

export type StakeBiddingToAnsweringCtx =
  TransitionContext<StakeBiddingToAnsweringPayload>;

export interface StakeBiddingToAnsweringMutationData {
  winnerPlayerId: number;
  finalBid: number | null;
  questionData: SimplePackageQuestionDTO | null;
}
