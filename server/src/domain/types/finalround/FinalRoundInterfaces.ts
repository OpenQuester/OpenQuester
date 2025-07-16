import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";

/**
 * Interface for player answer in final round
 */
export interface FinalRoundAnswer {
  id: string;
  playerId: number;
  answer: string;
  isCorrect?: boolean;
  autoLoss?: boolean;
  submittedAt: Date;
  reviewedAt?: Date;
}

/**
 * Interface for final round game state data
 */
export interface FinalRoundGameData {
  phase: FinalRoundPhase;
  /** Turn order for final round theme elimination */
  turnOrder: number[];
  bids: Record<number, number>; // playerId -> bidAmount
  answers: FinalRoundAnswer[];
  eliminatedThemes: number[];
}

/**
 * Interface for bid validation constraints
 */
export interface BidConstraints {
  minBid: number;
  maxBid: number;
  playerScore: number;
}
