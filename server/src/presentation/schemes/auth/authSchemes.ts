import Joi from "joi";

import {
  USER_NAME_MAX_CHARS,
  USER_NAME_MIN_CHARS,
} from "domain/constants/user";
import { GuestLoginDTO } from "domain/types/dto/auth/GuestLoginDTO";

export const socketAuthScheme = Joi.object({
  socketId: Joi.string().required(),
});

/**
 * Guest username (which becomes the display name) validation:
 * - 1-50 characters
 * - Allows Unicode letters, numbers, spaces
 * - No consecutive whitespaces
 * - Trims leading/trailing whitespace
 */
export const guestLoginScheme = Joi.object<GuestLoginDTO>({
  username: Joi.string()
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
    })
    .required(),
});
