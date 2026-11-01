import Joi from "joi";

export const filenameScheme = () =>
  Joi.object({
    // The whole name, not just part of it: a "/" or ".." would reach other storage keys
    filename: Joi.string()
      .pattern(/^[A-Za-z0-9_-]+$/)
      .required()
  });
