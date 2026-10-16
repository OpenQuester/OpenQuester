import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";

export interface QuestionToggleInputData {
  questionId: number;
}

/** A question was removed from the board (isPlayed) or put back */
export interface QuestionToggleEventPayload {
  questionId: number;
  isPlayed: boolean;
}

/** The showman took back a ruling: the score change is reverted */
export interface AnswerResultUndoEventPayload {
  playerId: number;
  revertedResult: number;
  newScore: number;
  /** After a wrong answer, the player may press the buzzer again */
  canAnswerAgain: boolean;
}

export interface GameJoinModeInputData {
  joinMode: GameJoinMode;
}

export interface GameJoinModeEventPayload {
  joinMode: GameJoinMode;
}

/** The showman opened the buzzer before the question finished */
export interface BuzzerOpenEventPayload {
  /** The SHOWING timer's elapsed time at which the buzzer is now open */
  buzzerOpensAtMs: number;
}
