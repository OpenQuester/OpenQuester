import Joi from "joi";

import {
  GAME_MAX_PLAYERS,
  GAME_TITLE_MAX_CHARS,
  GAME_TITLE_MIN_CHARS
} from "domain/constants/game";
import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { type GameUpdateDTO } from "domain/types/dto/game/GameUpdateDTO";
import { type GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
export { gameRedisDataScheme } from "domain/validators/schemas/GameRedisDataSchema";

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
      .optional()
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
    titlePrefix: Joi.string().optional()
  });
