import Joi from "joi";

import { type PlayerGameStatsRedisData } from "domain/types/statistics/PlayerGameStatsRedisData";

/**
 * Joi schema for validating PlayerGameStats Redis data.
 * All values in Redis are strings, so string formats are validated here.
 */
export const playerGameStatsDataScheme = () =>
  Joi.object<PlayerGameStatsRedisData>({
    gameId: Joi.string().required(),
    userId: Joi.string().pattern(/^\d+$/).required(),
    joinedAt: Joi.string().isoDate().required(),
    leftAt: Joi.alternatives()
      .try(Joi.string().isoDate(), Joi.string().allow(""))
      .optional(),
    currentScore: Joi.string().pattern(/^-?\d+$/).required(),
    questionsAnswered: Joi.string().pattern(/^\d+$/).required(),
    correctAnswers: Joi.string().pattern(/^\d+$/).required(),
    wrongAnswers: Joi.string().pattern(/^\d+$/).required(),
  });
