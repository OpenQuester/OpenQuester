import Joi from "joi";

import { GuestLoginDTO } from "domain/types/dto/auth/GuestLoginDTO";
import { nameValidation } from "../user/userSchemes";

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
  username: nameValidation.required(),
});
