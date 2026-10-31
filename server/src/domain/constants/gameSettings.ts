import {
  ALL_PLAY_ANSWER_TIME,
  GAME_FINAL_ANSWER_TIME,
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
  SECRET_QUESTION_TRANSFER_TIME,
  STAKE_QUESTION_BID_TIME
} from "domain/constants/game";
import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import type {
  GameSettingsDTO,
  GameTimerSettingsDTO
} from "domain/types/dto/game/settings/GameSettingsDTO";

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
  autoStart: true,
  falseStart: true,
  buttonPressMode: ButtonPressMode.RANDOM_WITHIN_WINDOW,
  wrongAnswerPenalty: WrongAnswerPenalty.SUBTRACT,
  timers: DEFAULT_GAME_TIMERS
});
