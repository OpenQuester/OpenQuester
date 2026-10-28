import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";
import {
  GameJoinModeChangeInputData,
  QuestionRemoveRestoreInputData
} from "domain/types/socket/events/game/ShowmanToolsEventPayloads";
import { ALL_PLAY_ANSWER_MAX_LENGTH } from "domain/constants/game";
import {
  AllPlayAnswerInputData,
  AllPlayReviewInputData,
  AllPlayStakeInputData
} from "domain/types/socket/events/game/AllPlayEventPayloads";
import Joi from "joi";

import {
  FINAL_ROUND_ANSWER_MAX_LENGTH,
  GAME_ID_CHARACTERS_LENGTH,
  STAKE_QUESTION_MIN_BID
} from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  ActionExecutionContext,
  AuthenticatedActionContext
} from "domain/types/action/ActionExecutionContext";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import { MediaDownloadedInputData } from "domain/types/socket/events/game/MediaDownloadedInputData";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  FinalAnswerSubmitInputData,
  FinalBidSubmitInputData,
  ThemeEliminateInputData
} from "domain/types/socket/events/FinalRoundEventData";
import {
  StakeBidSubmitInputData,
  StakeBidType
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  GameJoinInputData,
  PlayerKickInputData,
  PlayerRestrictionInputData,
  PlayerRoleChangeInputData,
  PlayerScoreChangeInputData,
  PlayerSlotChangeInputData,
  QuestionPickInputData,
  TurnPlayerChangeInputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultData, AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { AnswerSubmittedData } from "domain/types/socket/game/AnswerSubmittedData";
import {
  SecretQuestionPriceInputData,
  SecretQuestionTransferInputData
} from "domain/types/socket/game/SecretQuestionTransferData";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { SchemaValidator } from "domain/validators/SchemaValidator";

export class GameValidator {
  /**
   * Validates that the socket user is authenticated.
   *
   * @throws ClientError(SOCKET_USER_NOT_AUTHENTICATED) if the user is not authenticated.
   */
  public static validateSocketAuthenticated(
    userData: SocketRedisUserData | null
  ): asserts userData is SocketRedisUserData {
    if (!userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }
  }

  /**
   * Type guard that narrows {@link ActionExecutionContext} to
   * {@link AuthenticatedActionContext}.
   *
   * Validates that player is authenticated (socket auth + in-game)
   *
   * @throws ClientError(SOCKET_USER_NOT_AUTHENTICATED) if either field is null,
   *   so callers never have to write the null-check + throw themselves.
   */
  public static validatePlayerAuthenticated<T>(
    ctx: ActionExecutionContext<T>
  ): asserts ctx is AuthenticatedActionContext<T> {
    if (!ctx.userData) {
      throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
    }

    if (!ctx.currentPlayer || !ctx.userData.gameId) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }
  }

  public static validateJoinInput(data: GameJoinInputData) {
    const schema = Joi.object({
      gameId: Joi.string().length(GAME_ID_CHARACTERS_LENGTH).required(),
      role: Joi.valid(...Object.values(PlayerRole)).required(),
      targetSlot: Joi.number().integer().min(0).allow(null).optional().default(null),
      password: Joi.string()
        .max(16)
        .pattern(/^[A-Za-z0-9_-]+$/)
        .allow(null)
        .optional()
    });

    return this._validate<GameJoinInputData>(data, schema);
  }

  public static validateChatMessage(data: ChatMessageInputData) {
    const schema = Joi.object<ChatMessageInputData>({
      message: Joi.string().trim().required().min(1).max(255)
    });

    return this._validate<ChatMessageInputData>(data, schema);
  }

  public static validateMediaDownloaded(data: MediaDownloadedInputData) {
    const schema = Joi.object<MediaDownloadedInputData>({
      mediaDurations: Joi.array()
        .items(
          Joi.object({
            md5: Joi.string().max(64).required(),
            durationMs: Joi.number()
              .positive()
              .max(24 * 60 * 60 * 1000)
              .required()
          })
        )
        .max(100)
        .optional()
    });

    return this._validate<MediaDownloadedInputData>(data, schema);
  }

  public static validatePickQuestion(data: QuestionPickInputData) {
    const schema = Joi.object<QuestionPickInputData>({
      questionId: Joi.number().min(0).required()
    });

    return this._validate<QuestionPickInputData>(data, schema);
  }

  public static validateSecretQuestionTransfer(data: SecretQuestionTransferInputData) {
    const schema = Joi.object<SecretQuestionTransferInputData>({
      targetPlayerId: Joi.number().min(0).required()
    });

    return this._validate<SecretQuestionTransferInputData>(data, schema);
  }

  public static validateQuestionRemoveRestore(data: QuestionRemoveRestoreInputData) {
    return this._validate<QuestionRemoveRestoreInputData>(
      data,
      Joi.object<QuestionRemoveRestoreInputData>({ questionId: Joi.number().integer().required() })
    );
  }

  public static validateGameJoinModeChange(data: GameJoinModeChangeInputData) {
    return this._validate<GameJoinModeChangeInputData>(
      data,
      Joi.object<GameJoinModeChangeInputData>({
        joinMode: Joi.valid(...Object.values(GameJoinMode)).required()
      })
    );
  }

  public static validateAllPlayStake(data: AllPlayStakeInputData) {
    return this._validate<AllPlayStakeInputData>(
      data,
      Joi.object<AllPlayStakeInputData>({ amount: Joi.number().integer().min(0).required() })
    );
  }

  public static validateAllPlayAnswer(data: AllPlayAnswerInputData) {
    return this._validate<AllPlayAnswerInputData>(
      data,
      Joi.object<AllPlayAnswerInputData>({
        answerText: Joi.string().allow("").max(ALL_PLAY_ANSWER_MAX_LENGTH).required()
      })
    );
  }

  public static validateAllPlayReview(data: AllPlayReviewInputData) {
    return this._validate<AllPlayReviewInputData>(
      data,
      Joi.object<AllPlayReviewInputData>({
        playerId: Joi.number().integer().required(),
        isCorrect: Joi.boolean().required()
      })
    );
  }

  public static validateSecretQuestionPrice(data: SecretQuestionPriceInputData) {
    const schema = Joi.object<SecretQuestionPriceInputData>({
      price: Joi.number().integer().min(0).required()
    });

    return this._validate<SecretQuestionPriceInputData>(data, schema);
  }

  public static validateAnswerSubmitted(data: AnswerSubmittedData) {
    const schema = Joi.object<AnswerSubmittedData>({
      answerText: Joi.string().max(255).allow(null),
      choiceOrder: Joi.number()
    });

    return this._validate<AnswerSubmittedData>(data, schema);
  }

  public static validateAnswerResult(data: AnswerResultData) {
    const schema = Joi.object<AnswerResultData>({
      scoreResult: Joi.number().required(),
      answerType: Joi.valid(...Object.values(AnswerResultType)).required()
    });

    return this._validate<AnswerResultData>(data, schema);
  }

  public static validateThemeElimination(data: ThemeEliminateInputData) {
    const schema = Joi.object<ThemeEliminateInputData>({
      themeId: Joi.number().min(0).required()
    });

    return this._validate<ThemeEliminateInputData>(data, schema);
  }

  public static validateBid(data: FinalBidSubmitInputData) {
    const schema = Joi.object<FinalBidSubmitInputData>({
      bid: Joi.number().min(1).required()
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
        otherwise: Joi.valid(null).required()
      })
    });

    return this._validate<StakeBidSubmitInputData>(data, schema);
  }

  public static validateFinalAnswerSubmit(data: FinalAnswerSubmitInputData) {
    const schema = Joi.object<FinalAnswerSubmitInputData>({
      answerText: Joi.string().max(FINAL_ROUND_ANSWER_MAX_LENGTH).allow("", null)
    });

    return this._validate<FinalAnswerSubmitInputData>(data, schema);
  }

  public static validateFinalAnswerReview(data: FinalAnswerReviewInputData) {
    const schema = Joi.object<FinalAnswerReviewInputData>({
      answerId: Joi.string().required(),
      isCorrect: Joi.boolean().required()
    });

    return this._validate<FinalAnswerReviewInputData>(data, schema);
  }

  public static validatePlayerRoleChange(data: PlayerRoleChangeInputData) {
    const schema = Joi.object<PlayerRoleChangeInputData>({
      // null (or omitted) means "change my own role", as the contract documents
      playerId: Joi.number().min(0).allow(null),
      newRole: Joi.valid(...Object.values(PlayerRole)).required()
    });

    return this._validate<PlayerRoleChangeInputData>(data, schema);
  }

  public static validatePlayerRestriction(data: PlayerRestrictionInputData) {
    const schema = Joi.object<PlayerRestrictionInputData>({
      playerId: Joi.number().min(0).required(),
      muted: Joi.boolean().required(),
      restricted: Joi.boolean().required(),
      banned: Joi.boolean().required()
    });

    return this._validate<PlayerRestrictionInputData>(data, schema);
  }

  public static validatePlayerKick(data: PlayerKickInputData) {
    const schema = Joi.object<PlayerKickInputData>({
      playerId: Joi.number().min(0).required()
    });

    return this._validate<PlayerKickInputData>(data, schema);
  }

  public static validatePlayerScoreChange(data: PlayerScoreChangeInputData) {
    const schema = Joi.object<PlayerScoreChangeInputData>({
      playerId: Joi.number().min(0).required(),
      newScore: Joi.number().required()
    });

    return this._validate<PlayerScoreChangeInputData>(data, schema);
  }

  public static validateTurnPlayerChange(data: TurnPlayerChangeInputData) {
    const schema = Joi.object<TurnPlayerChangeInputData>({
      newTurnPlayerId: Joi.number().min(0).allow(null).required()
    });

    return this._validate<TurnPlayerChangeInputData>(data, schema);
  }

  public static validatePlayerSlotChange(data: PlayerSlotChangeInputData) {
    const schema = Joi.object<PlayerSlotChangeInputData>({
      targetSlot: Joi.number().min(0).required(),
      playerId: Joi.number().min(0)
    });

    return this._validate<PlayerSlotChangeInputData>(data, schema);
  }

  private static _validate<T>(data: T, schema: Joi.ObjectSchema<T>) {
    return new SchemaValidator<T>(data, schema).validate();
  }
}
