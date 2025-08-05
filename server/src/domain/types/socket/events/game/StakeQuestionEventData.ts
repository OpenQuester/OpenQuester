import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export enum StakeBidType {
  NORMAL = "normal",
  PASS = "pass",
  ALL_IN = "all-in",
}

/**
 * Data for stake question bid submission
 */
export interface StakeBidSubmitInputData {
  bidType: StakeBidType;
  /** Bid amount or null for pass/all-in */
  bidAmount: number | null;
}

export interface StakeBidSubmitOutputData {
  playerId: number;
  /** Actual bid amount (null for pass bids) */
  bidAmount: number | null;
  bidType: StakeBidType;
  /** True if bidding phase is complete and this player won */
  isPhaseComplete?: boolean;
  /** Next player to bid (null if phase complete) */
  nextBidderId?: number | null;
  /** Timer for the next bid or remaining time (30 seconds per bid) */
  timer?: GameStateTimerDTO;
}
