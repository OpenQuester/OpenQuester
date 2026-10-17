import { AllPlayDataDTO, AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

/** An "everyone answers" question started: stake phase (stake mode) or straight to the question */
export interface AllPlayStartEventPayload {
  mode: AllPlayMode;
  questionId: number;
  /** Players taking part */
  players: number[];
  price: number;
  maxStake: number | null;
  priceMultiplier: number | null;
  /** Stake timer in stake mode; null when the question comes next */
  timer: GameStateTimerDTO | null;
}

/** A player sent their stake or answer (the value stays hidden until review) */
export interface AllPlaySubmittedEventPayload {
  playerId: number;
}

/** Answers are in: every answer and stake is now visible for the review */
export interface AllPlayReviewingEventPayload {
  allPlay: AllPlayDataDTO;
}

/** The showman ruled on one answer */
export interface AllPlayReviewEventPayload {
  playerId: number;
  isCorrect: boolean;
  scoreChange: number;
  newScore: number;
}

export interface AllPlayStakeInputData {
  amount: number;
}

export interface AllPlayAnswerInputData {
  answerText: string;
}

export interface AllPlayReviewInputData {
  playerId: number;
  isCorrect: boolean;
}
