import {
  ALL_PLAY_ANSWER_TIME,
  GAME_FINAL_ANSWER_TIME,
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
  SECRET_QUESTION_TRANSFER_TIME,
  STAKE_QUESTION_BID_TIME
} from "domain/constants/game";

/** How the server picks the answerer when several players press */
export enum ButtonPressMode {
  /** Presses inside a short window after the first one are drawn at random */
  RANDOM_WITHIN_WINDOW = "random_within_window",
  /** The first press to reach the server answers */
  FIRST_WINS = "first_wins"
}

/** What a wrong answer to a buzzer question costs */
export enum WrongAnswerPenalty {
  /** The question's price is subtracted */
  SUBTRACT = "subtract",
  /** Nothing is subtracted */
  NONE = "none"
}

/** How long each step may take, in milliseconds */
export interface GameTimerSettingsDTO {
  /** To press the buzzer once the question has played */
  answerMs: number;
  /** To give the answer after pressing */
  answerSubmitMs: number;
  /** For each stake: auction bids, stakes for everyone and final bids */
  stakeMs: number;
  /** To hand a secret question over, and to pick its price */
  secretTransferMs: number;
  /** To write the answer when everyone answers */
  allPlayAnswerMs: number;
  /** To write the final answer */
  finalAnswerMs: number;
  /**
   * Length of a regular round; 0 means no limit. Once it has passed, the
   * round ends after the question in play.
   */
  roundMs: number;
}

/** Rules the host chooses when creating a game */
export interface GameSettingsDTO {
  /**
   * The buzzer opens after the question content (and a caption's reading
   * time); a press before that locks the player out for a moment. When off,
   * players may press at any time.
   */
  falseStart: boolean;
  buttonPressMode: ButtonPressMode;
  wrongAnswerPenalty: WrongAnswerPenalty;
  timers: GameTimerSettingsDTO;
}

export const DEFAULT_GAME_TIMERS: Readonly<GameTimerSettingsDTO> = Object.freeze({
  answerMs: GAME_QUESTION_ANSWER_TIME,
  answerSubmitMs: GAME_QUESTION_ANSWER_SUBMIT_TIME,
  stakeMs: STAKE_QUESTION_BID_TIME,
  secretTransferMs: SECRET_QUESTION_TRANSFER_TIME,
  allPlayAnswerMs: ALL_PLAY_ANSWER_TIME,
  finalAnswerMs: GAME_FINAL_ANSWER_TIME,
  roundMs: 0
});

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettingsDTO> = Object.freeze({
  falseStart: true,
  buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW,
  wrongAnswerPenalty: WrongAnswerPenalty.SUBTRACT,
  timers: DEFAULT_GAME_TIMERS
});

/** Partial settings as accepted on game creation */
export type GameSettingsInput = Partial<Omit<GameSettingsDTO, "timers">> & {
  timers?: Partial<GameTimerSettingsDTO>;
};

/** Fills missing settings (older games, partial input) with the defaults */
export function normalizeGameSettings(
  settings: GameSettingsInput | null | undefined
): GameSettingsDTO {
  return {
    ...DEFAULT_GAME_SETTINGS,
    ...(settings ?? {}),
    timers: { ...DEFAULT_GAME_TIMERS, ...(settings?.timers ?? {}) }
  };
}
