import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import {
  AnswerReviewData,
  FinalRoundQuestionData,
} from "domain/types/socket/finalround/FinalRoundResults";

/**
 * Data for theme elimination in final round
 */
export interface ThemeEliminateInputData {
  themeId: number;
}

export interface ThemeEliminateOutputData {
  themeId: number;
  eliminatedBy: number; // Player ID
  /** Next player to pick theme, null if elimination complete */
  nextPlayerId: number | null;
}

/**
 * Data for final round bid submission
 */
export interface FinalBidSubmitInputData {
  bid: number;
}

export interface FinalBidSubmitOutputData {
  playerId: number;
  bidAmount: number;
  isAutomatic?: boolean;
}

/**
 * Data for final round answer submission (text-based with 75-second timer)
 */
export interface FinalAnswerSubmitInputData {
  answerText: string;
}

export interface FinalAnswerSubmitOutputData {
  playerId: number;
}

/**
 * Data for final round phase completion events
 */
export interface FinalPhaseCompleteEventData {
  phase: FinalRoundPhase;
  nextPhase?: FinalRoundPhase;
  timer?: GameStateTimerDTO;
}

/**
 * Data for final round question data events
 */
export interface FinalQuestionEventData {
  questionData: FinalRoundQuestionData;
}

/**
 * Data for final round submit end event (answering phase completion)
 */
export interface FinalSubmitEndEventData {
  phase: FinalRoundPhase;
  nextPhase?: FinalRoundPhase;
  allReviews?: AnswerReviewData[]; // All answers revealed when transitioning to reviewing phase
}

/**
 * Automatic bid data structure
 */
export interface PlayerBidData {
  playerId: number;
  bidAmount: number;
}

/**
 * Result of initializing bidding phase
 */
export interface BiddingPhaseInitializationResult {
  automaticBids: PlayerBidData[];
  questionData?: FinalRoundQuestionData;
  timer?: GameStateTimerDTO;
}

/**
 * Data for final round auto loss events (empty answers, timeouts)
 */
export interface FinalAutoLossEventData {
  playerId: number;
  reason: FinalAnswerLossReason;
}
