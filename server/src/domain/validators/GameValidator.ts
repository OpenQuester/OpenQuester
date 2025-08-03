import Joi from "joi";

import {
  GAME_ID_CHARACTERS_LENGTH,
  STAKE_QUESTION_MIN_BID,
} from "domain/constants/game";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  FinalAnswerSubmitInputData,
  FinalBidSubmitInputData,
  ThemeEliminateInputData,
} from "domain/types/socket/events/FinalRoundEventData";
import {
  StakeBidSubmitInputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  PlayerKickInputData,
  PlayerRestrictionInputData,
  PlayerRoleChangeInputData,
  PlayerScoreChangeInputData,
  PlayerSlotChangeInputData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { AnswerSubmittedData } from "domain/types/socket/game/AnswerSubmittedData";
import { GameJoinData } from "domain/types/socket/game/GameJoinData";
import { GameQuestionPickData } from "domain/types/socket/game/question/GameQuestionPickData";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
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

  public static validateSecretQuestionTransfer(
    data: SecretQuestionTransferInputData
  ) {
    const schema = Joi.object<SecretQuestionTransferInputData>({
      targetPlayerId: Joi.number().min(0).required(),
    });

    return this._validate<SecretQuestionTransferInputData>(data, schema);
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

  public static validateThemeElimination(data: ThemeEliminateInputData) {
    const schema = Joi.object<ThemeEliminateInputData>({
      themeId: Joi.number().min(0).required(),
    });

    return this._validate<ThemeEliminateInputData>(data, schema);
  }

  public static validateBid(data: FinalBidSubmitInputData) {
    const schema = Joi.object<FinalBidSubmitInputData>({
      bid: Joi.number().min(1).required(),
    });

    return this._validate<FinalBidSubmitInputData>(data, schema);
  }

  public static validateStakeBid(data: StakeBidSubmitInputData) {
    const schema = Joi.object<StakeBidSubmitInputData>({
      bidType: Joi.string()
        .valid(...Object.values(StakeBidType))
        .required(),
      bidAmount: Joi.when("bidType", {
        is: StakeBidType.NORMAL,
        then: Joi.number().min(STAKE_QUESTION_MIN_BID).required(),
        otherwise: Joi.valid(null).required(),
      }),
    });

    return this._validate<StakeBidSubmitInputData>(data, schema);
  }

  public static validateFinalAnswerSubmit(data: FinalAnswerSubmitInputData) {
    const schema = Joi.object<FinalAnswerSubmitInputData>({
      answerText: Joi.string().max(255).allow("", null),
    });

    return this._validate<FinalAnswerSubmitInputData>(data, schema);
  }

  public static validateFinalAnswerReview(data: FinalAnswerReviewInputData) {
    const schema = Joi.object<FinalAnswerReviewInputData>({
      answerId: Joi.string().required(),
      isCorrect: Joi.boolean().required(),
    });

    return this._validate<FinalAnswerReviewInputData>(data, schema);
  }

  public static validatePlayerRoleChange(data: PlayerRoleChangeInputData) {
    const schema = Joi.object<PlayerRoleChangeInputData>({
      playerId: Joi.number().min(0),
      newRole: Joi.valid(...Object.values(PlayerRole)).required(),
    });

    return this._validate<PlayerRoleChangeInputData>(data, schema);
  }

  public static validatePlayerRestriction(data: PlayerRestrictionInputData) {
    const schema = Joi.object<PlayerRestrictionInputData>({
      playerId: Joi.number().min(0).required(),
      muted: Joi.boolean().required(),
      restricted: Joi.boolean().required(),
      banned: Joi.boolean().required(),
    });

    return this._validate<PlayerRestrictionInputData>(data, schema);
  }

  public static validatePlayerKick(data: PlayerKickInputData) {
    const schema = Joi.object<PlayerKickInputData>({
      playerId: Joi.number().min(0).required(),
    });

    return this._validate<PlayerKickInputData>(data, schema);
  }

  public static validatePlayerScoreChange(data: PlayerScoreChangeInputData) {
    const schema = Joi.object<PlayerScoreChangeInputData>({
      playerId: Joi.number().min(0).required(),
      newScore: Joi.number().required(),
    });

    return this._validate<PlayerScoreChangeInputData>(data, schema);
  }

  public static validateTurnPlayerChange(data: TurnPlayerChangeInputData) {
    const schema = Joi.object<TurnPlayerChangeInputData>({
      newTurnPlayerId: Joi.number().min(0).allow(null).required(),
    });

    return this._validate<TurnPlayerChangeInputData>(data, schema);
  }

  public static validatePlayerSlotChange(data: PlayerSlotChangeInputData) {
    const schema = Joi.object<PlayerSlotChangeInputData>({
      targetSlot: Joi.number().min(0).required(),
      playerId: Joi.number().min(0),
    });

    return this._validate<PlayerSlotChangeInputData>(data, schema);
  }

  private static _validate<T>(data: T, schema: Joi.ObjectSchema<T>) {
    return new RequestDataValidator<T>(data, schema).validate();
  }
}
