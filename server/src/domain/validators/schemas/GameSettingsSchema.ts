import Joi from "joi";

import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import type {
  GameSettingsInput,
  GameTimerSettingsDTO
} from "domain/types/dto/game/settings/GameSettingsDTO";

const SECOND = 1000;
const ms = (minSeconds: number, maxSeconds: number) =>
  Joi.number()
    .integer()
    .min(minSeconds * SECOND)
    .max(maxSeconds * SECOND)
    .optional();

/** Timer limits in milliseconds */
export const gameTimerSettingsScheme = () =>
  Joi.object<GameTimerSettingsDTO>({
    answerMs: ms(3, 120),
    answerSubmitMs: ms(5, 180),
    stakeMs: ms(5, 120),
    secretTransferMs: ms(5, 120),
    allPlayAnswerMs: ms(10, 300),
    finalAnswerMs: ms(10, 300),
    // 0 = no limit, otherwise 5 minutes to 3 hours
    roundMs: Joi.alternatives()
      .try(Joi.valid(0), ms(5 * 60, 3 * 60 * 60))
      .optional()
  });

/** Rules and timers as accepted on game creation and when the showman changes them */
export const gameSettingsScheme = () =>
  Joi.object<GameSettingsInput>({
    autoStart: Joi.boolean().optional(),
    falseStart: Joi.boolean().optional(),
    buttonPressMode: Joi.valid(...Object.values(ButtonPressMode)).optional(),
    wrongAnswerPenalty: Joi.valid(...Object.values(WrongAnswerPenalty)).optional(),
    timers: gameTimerSettingsScheme().optional()
  });
