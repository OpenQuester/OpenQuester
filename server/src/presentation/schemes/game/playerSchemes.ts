import { PlayerGameStatsRedisData } from "domain/types/statistics/PlayerGameStatsRedisData";
import Joi from "joi";

/**
 * Joi schema for validating PlayerGameStats Redis data
 * All values in Redis are strings, so we validate string formats
 */
export const playerGameStatsDataScheme = () =>
  Joi.object<PlayerGameStatsRedisData>({
    gameId: Joi.string().required(),
    userId: Joi.string().pattern(/^\d+$/).required(), // Numeric string
    joinedAt: Joi.string().isoDate().required(), // ISO date string
    leftAt: Joi.alternatives()
      .try(Joi.string().isoDate(), Joi.string().allow(""))
      .optional(),
    currentScore: Joi.string()
      .pattern(/^-?\d+$/)
      .required(), // Numeric string (can be negative)
    questionsAnswered: Joi.string().pattern(/^\d+$/).required(), // Non-negative numeric string
    correctAnswers: Joi.string().pattern(/^\d+$/).required(), // Non-negative numeric string
    wrongAnswers: Joi.string().pattern(/^\d+$/).required(), // Non-negative numeric string
  });
