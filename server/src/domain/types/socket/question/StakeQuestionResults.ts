import { Game } from "domain/entities/game/Game";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { TransitionResult } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";

export interface StakeBidSubmitResult {
  data: StakeBidSubmitOutputData;
  broadcasts: SocketEventBroadcast[];
  game: Game;
  playerId: number;
  bidAmount: number | null;
  bidType: StakeBidType;
  isPhaseComplete: boolean;
  nextBidderId: number | null;
  winnerPlayerId: number | null;
  questionData: SimplePackageQuestionDTO | PackageQuestionDTO | null;
  timer?: GameStateTimerDTO;
}

/**
 * Mutation details produced when stake bidding timer expires.
 */
export interface StakeBiddingTimeoutMutationResult {
  currentBidderId: number;
  bidType: StakeBidType;
  bidAmount: number | null;
  isPhaseComplete: boolean;
  nextBidderId: number | null;
  winnerPlayerId: number | null;
  highestBid: number | null;
}

/**
 * Input used by StakeBiddingTimeoutLogic to build final result.
 */
export interface StakeBiddingTimeoutResultInput {
  game: Game;
  mutationResult: StakeBiddingTimeoutMutationResult;
  transitionResult: TransitionResult | null;
  timer?: GameStateTimerDTO;
}

/**
 * Result returned by stake bidding timeout processing.
 */
export interface StakeBiddingTimeoutResult {
  mutationResult: StakeBiddingTimeoutMutationResult;
  transitionResult: TransitionResult | null;
  broadcasts: BroadcastEvent[];
}
