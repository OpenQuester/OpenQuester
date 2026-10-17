import Joi from "joi";

import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { type AdminGameListQuery } from "domain/types/admin/AdminTypes";

export const adminGameListScheme = () =>
  Joi.object<AdminGameListQuery>({
    limit: Joi.number().integer().min(LIMIT_MIN).max(LIMIT_MAX).default(20),
    offset: Joi.number().integer().min(OFFSET_MIN).default(0),
    search: Joi.string().trim().max(100).allow("").optional()
  });

export const adminGamePlayerScheme = () =>
  Joi.object<{ gameId: string; playerId: number }>({
    gameId: Joi.string()
      .pattern(/^[A-Z0-9]+$/)
      .required(),
    playerId: Joi.number().integer().min(0).required()
  });

export const adminUserIdScheme = () =>
  Joi.object<{ userId: number }>({ userId: Joi.number().integer().min(0).required() });
