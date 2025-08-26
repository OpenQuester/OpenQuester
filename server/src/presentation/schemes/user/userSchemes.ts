import Joi from "joi";

import {
  USER_NAME_MAX_CHARS,
  USER_NAME_MIN_CHARS,
  USER_USERNAME_MAX_CHARS,
  USER_USERNAME_MIN_CHARS,
} from "domain/constants/user";
import { UserStatus } from "domain/enums/user/UserStatus";
import { UserType } from "domain/enums/user/UserType";
import { UpdateUserInputDTO } from "domain/types/dto/user/UpdateUserInputDTO";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";

/**
 * Discord-style username validation:
 * - 2-32 characters
 * - Lowercase letters, numbers, underscore, period only
 * - No consecutive periods
 */
const usernameScheme = Joi.string()
  .min(USER_USERNAME_MIN_CHARS)
  .max(USER_USERNAME_MAX_CHARS)
  .custom((value, helpers) => {
    // Check pattern
    if (!/^[a-z0-9_.]+$/.test(value)) {
      return helpers.error("string.pattern.name");
    }

    // Check for consecutive periods
    if (value.includes("..")) {
      return helpers.error("username.consecutivePeriods");
    }

    return value;
  }, "Username normalization")
  .messages({
    "username.consecutivePeriods":
      "Username cannot contain consecutive periods",
    "string.pattern.name":
      "Username can only contain lowercase letters, numbers, underscores, and periods",
  });

/**
 * Name validation:
 * - 1-50 characters
 * - Allows Unicode letters, numbers, spaces
 * - No consecutive whitespaces
 * - Trims leading/trailing whitespace
 */
export const nameScheme = Joi.string()
  .min(USER_NAME_MIN_CHARS)
  .max(USER_NAME_MAX_CHARS)
  .pattern(/^[\p{L}\p{N}\s]*$/u, "Name pattern")
  .custom((value, helpers) => {
    // Trim whitespace
    const trimmed = value.trim();
    // Check for consecutive whitespaces
    if (/\s{2,}/.test(trimmed)) {
      return helpers.error("name.consecutiveSpaces");
    }
    return trimmed;
  }, "Name normalization")
  .messages({
    "name.consecutiveSpaces": "Name cannot contain consecutive spaces",
    "string.pattern.name":
      "Name can only contain letters, numbers, and single spaces",
  });

export const userIdScheme = () =>
  Joi.object({
    userId: Joi.number().min(0).required(),
  });

export const userUpdateScheme = () =>
  Joi.object<UpdateUserInputDTO>({
    email: Joi.string().email().allow(null),
    username: usernameScheme.allow(null),
    name: nameScheme.allow(null),
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
    userType: Joi.string()
      .valid(...Object.values(UserType))
      .optional(),
  });
