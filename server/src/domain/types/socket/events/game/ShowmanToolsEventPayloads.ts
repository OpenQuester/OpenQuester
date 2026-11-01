import type {
  GameSettingsDTO,
  GameSettingsInput
} from "domain/types/dto/game/settings/GameSettingsDTO";
import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";

export interface QuestionRemoveRestoreInputData {
  questionId: number;
}

/** A question was removed from the board (isPlayed) or put back */
export interface QuestionRemoveRestoreEventPayload {
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

export interface GameJoinModeChangeInputData {
  joinMode: GameJoinMode;
}

export interface GameJoinModeChangeEventPayload {
  joinMode: GameJoinMode;
}

/** Any subset of the rules and timers; omitted fields keep their current value */
export type GameSettingsChangeInputData = GameSettingsInput;

/** The game's rules after the showman changed them */
export interface GameSettingsChangeEventPayload {
  settings: GameSettingsDTO;
}

/** The showman opened the buzzer before the question finished */
export interface BuzzerOpenEventPayload {
  /** The SHOWING timer's elapsed time at which the buzzer is now open */
  buzzerOpensAtMs: number;
}
