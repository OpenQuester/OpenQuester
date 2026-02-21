import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import Joi from "joi";

export const gameStateDataSchema = () =>
  Joi.object<Pick<GameStateDTO, "currentRound">>({
    currentRound: Joi.object({
      themes: Joi.array()
        .items(
          Joi.object({
            questions: Joi.array()
              .items(
                Joi.object({
                  id: Joi.number().required(),
                }).unknown(true)
              )
              .required(),
          }).unknown(true)
        )
        .required(),
    })
      .unknown(true)
      .allow(null),
  }).unknown(true);
