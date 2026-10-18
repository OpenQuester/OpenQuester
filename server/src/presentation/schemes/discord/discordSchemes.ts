import Joi from "joi";

import { type DiscordActivityLoginInputDTO } from "domain/types/dto/discord/DiscordActivityLoginDTO";

/** Discord instance ids look like `i-1234567890123456789-gc-...` */
export const discordInstanceIdScheme = () =>
  Joi.object({
    instanceId: Joi.string()
      .max(128)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .required()
  });

export const discordActivityLoginScheme = () =>
  Joi.object<DiscordActivityLoginInputDTO>({
    code: Joi.string().max(512).required()
  });
