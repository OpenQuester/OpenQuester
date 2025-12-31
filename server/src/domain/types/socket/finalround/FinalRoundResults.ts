import { Game } from "domain/entities/game/Game";
import { FinalAnswerType } from "domain/enums/FinalRoundTypes";
import { TransitionResult } from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { FinalRoundQuestionData } from "domain/types/finalround/FinalRoundInterfaces";
import { PlayerBidData } from "../events/FinalRoundEventData";
import { QuestionAnswerData } from "./QuestionAnswerData";

export interface AnswerReviewData {
  playerId: number;
  answerId: string;
  answerText: string;
  scoreChange: number;
  answerType: FinalAnswerType;
  isCorrect?: boolean;
}

export interface ThemeEliminateResult {
  game: Game;
  eliminatedBy: number; // Player ID
  themeId: number;
  nextPlayerId: number | null;
  isPhaseComplete: boolean;
  timer?: GameStateTimerDTO;
  /** Transition result for direct broadcast pass-through */
  transitionResult?: TransitionResult | null;
}

export interface FinalBidSubmitResult {
  game: Game;
  playerId: number;
  bidAmount: number;
  isPhaseComplete: boolean;
  /** Transition result for direct broadcast pass-through */
  transitionResult: TransitionResult | null;
  timer?: GameStateTimerDTO;
}

export interface FinalAnswerSubmitResult {
  game: Game;
  playerId: number;
  isPhaseComplete: boolean;
  isAutoLoss: boolean;
  allReviews?: AnswerReviewData[]; // All answers revealed when transitioning to reviewing phase
  /** Transition result for direct broadcast pass-through */
  transitionResult?: TransitionResult;
}

export interface FinalAnswerReviewResult {
  game: Game;
  isGameFinished: boolean;
  reviewResult: AnswerReviewData;
  allReviews?: AnswerReviewData[]; // For showman to see all reviews when phase transitions
  questionAnswerData?: QuestionAnswerData; // For when game finishes, show the correct answer
}

export interface ThemeEliminationTimeoutResult {
  game: Game;
  themeId: number;
  nextPlayerId: number | null;
  isPhaseComplete: boolean;
  timer?: GameStateTimerDTO;
  /** Transition result for direct broadcast pass-through */
  transitionResult?: TransitionResult | null;
}

export interface BiddingTimeoutResult {
  game: Game;
  timeoutBids: Array<PlayerBidData>;
  questionData: FinalRoundQuestionData;
  timer: GameStateTimerDTO;
  /** Transition result for direct broadcast pass-through */
  transitionResult: TransitionResult;
}

/**
 * Standard answer data structure
 */
export interface AnswerData {
  id: string;
  playerId: number;
  answer: string;
  autoLoss?: boolean;
}

/**
 * Strictly typed auto loss process result
 */
export interface AutoLossProcessResult {
  game: Game;
  autoLossReviews: AnswerReviewData[];
  isReadyForReview: boolean;
  allReviews?: AnswerReviewData[]; // For showman when transitioning to review phase
  /** Transition result for direct broadcast pass-through */
  transitionResult: TransitionResult | null;
}
