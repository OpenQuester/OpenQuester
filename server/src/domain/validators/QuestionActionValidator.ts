import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export interface QuestionActionContext {
  readonly game: Game;
  readonly currentPlayer: Player | null;
  readonly action: QuestionAction;
}

/**
 * Validator for question-related actions and states
 * Centralizes validation logic for better maintainability
 */
export class QuestionActionValidator {
  /**
   * Validates answer action requirements
   */
  public static validateAnswerAction(context: QuestionActionContext): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
    this._validateQuestionAnswering(
      context.game,
      context.currentPlayer!.meta.id
    );
  }

  /**
   * Validates skip action requirements for players
   */
  public static validatePlayerSkipAction(context: QuestionActionContext): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
    this._validateQuestionSkipping(context.game);
    this._validatePlayerCanSkip(context.game, context.currentPlayer!);
  }

  /**
   * Validates forced skip action requirements for showman
   */
  public static validateForceSkipAction(context: QuestionActionContext): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
    this._validateQuestionSkipping(context.game);
  }

  /**
   * Validates unskip action requirements
   */
  public static validateUnskipAction(context: QuestionActionContext): void {
    this._validateBasicRequirements(context);
    this._validateQuestionUnskipping(context.game);
    this._validatePlayerHasSkipped(context.game, context.currentPlayer!);
  }

  /**
   * Validates question pick action requirements
   */
  public static validatePickAction(context: QuestionActionContext): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
    this._validateQuestionPicking(context.game);
  }

  /**
   * Validates answer result action requirements
   */
  public static validateAnswerResultAction(
    context: QuestionActionContext
  ): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
  }

  /**
   * Validates submit answer action requirements
   */
  public static validateSubmitAnswerAction(
    context: QuestionActionContext
  ): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
    this._validatePlayerIsAnswering(context.game, context.currentPlayer!);
  }

  private static _validateBasicRequirements(
    context: QuestionActionContext
  ): void {
    if (!context.currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this._validateCurrentRound(context.game);
  }

  private static _validateQuestionAction(context: QuestionActionContext): void {
    const { currentPlayer, game, action } = context;

    switch (action) {
      case QuestionAction.PLAYER_SKIP:
        if (currentPlayer!.role !== PlayerRole.PLAYER) {
          throw new ClientError(ClientResponse.ONLY_PLAYERS_CAN_SKIP);
        }
        break;
      case QuestionAction.ANSWER:
        if (
          currentPlayer!.role === PlayerRole.SHOWMAN ||
          currentPlayer!.role === PlayerRole.SPECTATOR
        ) {
          throw new ClientError(ClientResponse.YOU_CANNOT_ANSWER_QUESTION);
        }
        break;
      case QuestionAction.SUBMIT_ANSWER:
        if (currentPlayer!.role !== PlayerRole.PLAYER) {
          throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
        }
        break;
      case QuestionAction.RESULT:
        if (currentPlayer!.role !== PlayerRole.SHOWMAN) {
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_SEND_ANSWER_RESULT);
        }
        break;
      case QuestionAction.SKIP:
        if (currentPlayer!.role !== PlayerRole.SHOWMAN) {
          throw new ClientError(
            ClientResponse.ONLY_SHOWMAN_SKIP_QUESTION_FORCE
          );
        }
        break;
      case QuestionAction.PICK:
        if (
          currentPlayer!.role !== PlayerRole.PLAYER &&
          currentPlayer!.role !== PlayerRole.SHOWMAN
        ) {
          throw new ClientError(ClientResponse.YOU_CANNOT_PICK_QUESTION);
        }
        if (
          game.gameState.currentRound?.type === PackageRoundType.SIMPLE &&
          game.gameState.currentTurnPlayerId !== currentPlayer!.meta.id &&
          currentPlayer!.role !== PlayerRole.SHOWMAN
        ) {
          throw new ClientError(ClientResponse.NOT_YOUR_TURN);
        }
        break;
    }
  }

  private static _validateQuestionAnswering(
    game: Game,
    currentPlayerId: number
  ): void {
    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }

    if (!ValueUtils.isBad(game.gameState.answeringPlayer)) {
      throw new ClientError(ClientResponse.SOMEONE_ALREADY_ANSWERING);
    }

    const isAnswered = !!game.gameState.answeredPlayers?.find(
      (answerResult) => answerResult.player === currentPlayerId
    );

    if (isAnswered) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED);
    }
  }

  private static _validateQuestionSkipping(game: Game): void {
    this._validateCurrentRound(game);

    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }
  }

  private static _validateQuestionUnskipping(game: Game): void {
    this._validateCurrentRound(game);

    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }
  }

  private static _validateQuestionPicking(game: Game): void {
    this._validateCurrentRound(game);

    if (game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PICKED);
    }
  }

  private static _validateCurrentRound(game: Game): void {
    if (!game.gameState.currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }
  }

  private static _validatePlayerCanSkip(
    game: Game,
    currentPlayer: Player
  ): void {
    if (game.gameState.answeringPlayer === currentPlayer.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SKIP_WHILE_ANSWERING);
    }

    const hasAnswered = game.gameState.answeredPlayers?.some(
      (answeredPlayer) => answeredPlayer.player === currentPlayer.meta.id
    );

    if (hasAnswered) {
      throw new ClientError(ClientResponse.ALREADY_ANSWERED_QUESTION);
    }
  }

  private static _validatePlayerHasSkipped(
    game: Game,
    currentPlayer: Player
  ): void {
    if (!game.hasPlayerSkipped(currentPlayer.meta.id)) {
      throw new ClientError(ClientResponse.PLAYER_NOT_SKIPPED);
    }
  }

  private static _validatePlayerIsAnswering(
    game: Game,
    currentPlayer: Player
  ): void {
    if (game.gameState.answeringPlayer !== currentPlayer.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }
  }
}
