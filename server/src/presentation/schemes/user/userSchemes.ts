import Joi from "joi";

import {
  USER_NAME_MAX_CHARS,
  USER_NAME_MIN_CHARS,
} from "domain/constants/user";
import { UserStatus } from "domain/enums/user/UserStatus";
import { UpdateUserInputDTO } from "domain/types/dto/user/UpdateUserInputDTO";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";

export const userIdScheme = () =>
  Joi.object({
    userId: Joi.number().min(0).required(),
  });

export const userUpdateScheme = () =>
  Joi.object<UpdateUserInputDTO>({
    email: Joi.string().email().allow(null),
    username: Joi.string()
      .min(USER_NAME_MIN_CHARS)
      .max(USER_NAME_MAX_CHARS)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .allow(null),
    avatar: Joi.string().allow(null),
    birthday: Joi.alternatives().try(Joi.date(), Joi.string()).allow(null),
  });

export const userPaginationScheme = () =>
  Joi.object({
    sortBy: Joi.string().valid(
      "id",
      "is_deleted",
      "created_at",
      "username",
      "email",
      "updated_at"
    ),
    order: Joi.valid(...Object.values(PaginationOrder)),
    limit: Joi.number().integer().min(1).max(100).default(10),
    offset: Joi.number().integer().min(0).default(0),
    search: Joi.string().min(1).max(128).optional(),
    status: Joi.string()
      .valid(...Object.values(UserStatus))
      .optional(),
  });
