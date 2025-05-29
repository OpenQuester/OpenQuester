import Joi from "joi";

import { GAME_ID_CHARACTERS_LENGTH } from "domain/constants/game";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { AnswerSubmittedData } from "domain/types/socket/game/AnswerSubmittedData";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { GameQuestionPickData } from "domain/types/socket/game/question/GameQuestionPickData";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

export class GameValidator {
  public static validateJoinInput(data: GameJoinData) {
    const schema = Joi.object({
      gameId: Joi.string().length(GAME_ID_CHARACTERS_LENGTH).required(),
      role: Joi.valid(...Object.values(PlayerRole)).required(),
    });

    return this._validate<GameJoinData>(data, schema);
  }

  public static validateChatMessage(data: ChatMessageInputData) {
    const schema = Joi.object<ChatMessageInputData>({
      message: Joi.string().required().min(1).max(255),
    });

    return this._validate<ChatMessageInputData>(data, schema);
  }

  public static validatePickQuestion(data: GameQuestionPickData) {
    const schema = Joi.object<GameQuestionPickData>({
      questionId: Joi.number().min(0).required(),
    });

    return this._validate<GameQuestionPickData>(data, schema);
  }

  public static validateAnswerSubmitted(data: AnswerSubmittedData) {
    const schema = Joi.object<AnswerSubmittedData>({
      answerText: Joi.string().max(255).allow(null),
    });

    return this._validate<AnswerSubmittedData>(data, schema);
  }

  public static validateAnswerResult(data: AnswerResultData) {
    const schema = Joi.object<AnswerResultData>({
      scoreResult: Joi.number().required(),
      answerType: Joi.valid(...Object.values(AnswerResultType)).required(),
    });

    return this._validate<AnswerResultData>(data, schema);
  }

  private static _validate<T>(data: T, schema: Joi.ObjectSchema<T>) {
    return new RequestDataValidator<T>(data, schema).validate();
  }
}
