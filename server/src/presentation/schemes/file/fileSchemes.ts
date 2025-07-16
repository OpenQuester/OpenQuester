import Joi from "joi";

import { MAX_FILE_SIZE } from "domain/constants/storage";

export const filenameScheme = () =>
  Joi.object({
    filename: Joi.string()
      .pattern(/\b[a-f0-9]+\b/)
      .required(),
  });

export const fileUploadBodyScheme = () =>
  Joi.object({
    size: Joi.number()
      .integer()
      .min(1)
      .max(MAX_FILE_SIZE)
      .required(),
  });
