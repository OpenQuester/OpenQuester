import { ButtonPressMode, WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import type { GameSettingsInput } from "domain/types/dto/game/settings/GameSettingsDTO";
import Joi from "joi";

import {
  GAME_MAX_PLAYERS,
  GAME_TITLE_MAX_CHARS,
  GAME_TITLE_MIN_CHARS
} from "domain/constants/game";
import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameStatusFilter } from "domain/enums/game/GameStatusFilter";
import { type GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { type GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
export { gameRedisDataScheme } from "domain/validators/schemas/GameRedisDataSchema";

const SECOND = 1000;
const ms = (minSeconds: number, maxSeconds: number) =>
  Joi.number()
    .integer()
    .min(minSeconds * SECOND)
    .max(maxSeconds * SECOND)
    .optional();

export const gameSettingsScheme = () =>
  Joi.object<GameSettingsInput>({
    autoStart: Joi.boolean().optional(),
    falseStart: Joi.boolean().optional(),
    buttonPressMode: Joi.valid(...Object.values(ButtonPressMode)).optional(),
    wrongAnswerPenalty: Joi.valid(...Object.values(WrongAnswerPenalty)).optional(),
    timers: Joi.object({
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
    }).optional()
  });

export const gameIdScheme = () =>
  Joi.object({
    gameId: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required()
  });

export const createGameScheme = () =>
  Joi.object({
    title: Joi.string().min(GAME_TITLE_MIN_CHARS).max(GAME_TITLE_MAX_CHARS).required(),
    packageId: Joi.number().min(1).required(),
    isPrivate: Joi.boolean().required(),
    ageRestriction: Joi.valid(...Object.values(AgeRestriction)).required(),
    maxPlayers: Joi.number().max(GAME_MAX_PLAYERS).required(),
    password: Joi.string()
      .max(16)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .optional(),
    settings: gameSettingsScheme().optional()
  });

export const updateGameScheme = () =>
  Joi.object<GameUpdateDTO>({
    title: Joi.string().min(GAME_TITLE_MIN_CHARS).max(GAME_TITLE_MAX_CHARS).optional(),
    packageId: Joi.number().min(1).optional(),
    isPrivate: Joi.boolean().optional(),
    ageRestriction: Joi.valid(...Object.values(AgeRestriction)).optional(),
    maxPlayers: Joi.number().max(GAME_MAX_PLAYERS).optional(),
    password: Joi.alternatives()
      .try(
        Joi.string()
          .max(16)
          .pattern(/^[A-Za-z0-9_-]+$/),
        Joi.valid(null)
      )
      .optional()
  });

export const gamePaginationScheme = () =>
  Joi.object<GamePaginationOpts>({
    sortBy: Joi.string().valid("title", "createdAt", "isPrivate").default("createdAt"),
    order: Joi.string()
      .valid(PaginationOrder.ASC, PaginationOrder.DESC)
      .default(PaginationOrder.ASC),
    limit: Joi.number().min(LIMIT_MIN).max(LIMIT_MAX).required(),
    offset: Joi.number().min(OFFSET_MIN).required(),
    createdAtMax: Joi.date().optional(),
    createdAtMin: Joi.date().optional(),
    isPrivate: Joi.boolean().optional(),
    titlePrefix: Joi.string().optional(),
    status: Joi.string()
      .valid(...Object.values(GameStatusFilter))
      .optional()
  });
