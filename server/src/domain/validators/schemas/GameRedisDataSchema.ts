import Joi from "joi";

import { GAME_ID_CHARACTERS_LENGTH } from "domain/constants/game";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { type GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";

/**
 * Joi schema for validating Game Redis data.
 * All values in Redis are strings, so string formats are validated here.
 */
export const gameRedisDataScheme = () =>
  Joi.object<GameRedisHashDTO>({
    id: Joi.string().length(GAME_ID_CHARACTERS_LENGTH).required(),
    createdBy: Joi.string().pattern(/^\d+$/).required(),
    title: Joi.string().min(1).max(255).required(),
    createdAt: Joi.string().pattern(/^\d+$/).required(),
    isPrivate: Joi.string().valid("0", "1").required(),
    ageRestriction: Joi.string()
      .valid(...Object.values(AgeRestriction))
      .required(),
    players: Joi.string().required(),
    maxPlayers: Joi.string().pattern(/^\d+$/).required(),
    startedAt: Joi.alternatives()
      .try(Joi.string().allow(""), Joi.date().iso())
      .optional(),
    finishedAt: Joi.alternatives()
      .try(Joi.string().allow(""), Joi.date().iso())
      .optional(),
    roundIndex: Joi.string().required(),
    roundsCount: Joi.string().pattern(/^\d+$/).required(),
    questionsCount: Joi.string().pattern(/^\d+$/).required(),
    gameState: Joi.string().required(),
  });
