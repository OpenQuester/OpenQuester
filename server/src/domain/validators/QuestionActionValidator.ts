import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { SpecialRegularQuestionUtils } from "domain/utils/QuestionUtils";
import { GameStateValidator } from "domain/validators/GameStateValidator";
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

    const { game, currentPlayer } = context;

    if (!game.isPlayerEligibleToAnswer(currentPlayer!.meta.id)) {
      throw new ClientError(
        ClientResponse.YOU_CANNOT_PARTICIPATE_IN_CURRENT_QUESTION
      );
    }

    // Check if current question is a special question type (noRisk, secret, stake)
    const isSpecialQuestion =
      SpecialRegularQuestionUtils.isSingleAnswererQuestion(game);

    if (isSpecialQuestion) {
      // Special questions: different rules based on phase
      if (game.gameState.questionState === QuestionState.ANSWERING) {
        // During ANSWERING phase: only answering player can skip (give up)
        if (game.gameState.answeringPlayer !== currentPlayer!.meta.id) {
          throw new ClientError(ClientResponse.CANNOT_SKIP_WHILE_NOT_ANSWERING);
        }
      } else {
        // Other phases (BIDDING, SECRET_TRANSFER, etc.): no skipping allowed
        throw new ClientError(ClientResponse.CANNOT_SKIP_WHILE_NOT_ANSWERING);
      }
    } else {
      // Regular questions: all players can skip during SHOWING phase
      if (game.gameState.questionState !== QuestionState.SHOWING) {
        throw new ClientError(ClientResponse.CANNOT_SKIP_WHILE_ANSWERING);
      }

      // Prevent skipping if player has already answered
      const hasAnswered = game.gameState.answeredPlayers?.some(
        (answeredPlayer) => answeredPlayer.player === currentPlayer!.meta.id
      );

      if (hasAnswered) {
        throw new ClientError(ClientResponse.ALREADY_ANSWERED_QUESTION);
      }
    }
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
   * Validates basic requirements and ability to perform answer result action
   */
  public static validateAnswerResultAction(
    context: QuestionActionContext
  ): void {
    this._validateBasicRequirements(context);
    this._validateQuestionAction(context);
  }

  private static _validateBasicRequirements(
    context: QuestionActionContext
  ): void {
    if (!context.currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    this._validateCurrentRound(context.game);
    GameStateValidator.validateGameNotPaused(context.game);
  }

  private static _validateQuestionAction(context: QuestionActionContext): void {
    const { currentPlayer, game, action } = context;

    switch (action) {
      case QuestionAction.PLAYER_SKIP:
        if (currentPlayer?.role !== PlayerRole.PLAYER) {
          throw new ClientError(ClientResponse.ONLY_PLAYERS_CAN_SKIP);
        }
        break;
      case QuestionAction.ANSWER:
        if (
          currentPlayer?.role === PlayerRole.SHOWMAN ||
          currentPlayer?.role === PlayerRole.SPECTATOR
        ) {
          throw new ClientError(ClientResponse.YOU_CANNOT_ANSWER_QUESTION);
        }
        break;
      case QuestionAction.SUBMIT_ANSWER:
        if (currentPlayer?.role !== PlayerRole.PLAYER) {
          throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
        }
        break;
      case QuestionAction.ANSWER_RESULT:
        if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_SEND_ANSWER_RESULT);
        }
        break;
      case QuestionAction.FORCE_SKIP:
        if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
          throw new ClientError(
            ClientResponse.ONLY_SHOWMAN_SKIP_QUESTION_FORCE
          );
        }
        break;
      case QuestionAction.PICK:
        if (
          currentPlayer?.role !== PlayerRole.PLAYER &&
          currentPlayer?.role !== PlayerRole.SHOWMAN
        ) {
          throw new ClientError(ClientResponse.YOU_CANNOT_PICK_QUESTION);
        }
        if (
          game.gameState.currentRound?.type === PackageRoundType.SIMPLE &&
          game.gameState.currentTurnPlayerId !== currentPlayer?.meta.id &&
          currentPlayer?.role !== PlayerRole.SHOWMAN
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

    // Check if player is eligible to answer (was present when question started)
    // This prevents players who joined mid-question from answering
    if (!game.isPlayerEligibleToAnswer(currentPlayerId)) {
      throw new ClientError(
        ClientResponse.YOU_CANNOT_ANSWER_RIGHT_AFTER_BECOMING_PLAYER
      );
    }

    // For secret questions where a specific player is designated to answer,
    // allow that player to answer even if answeringPlayer is set
    if (
      !ValueUtils.isBad(game.gameState.answeringPlayer) &&
      game.gameState.answeringPlayer !== currentPlayerId
    ) {
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

    // Allow skipping if there's a current question OR if there's an active stake question
    if (
      !game.gameState.currentQuestion &&
      !(game.gameState.stakeQuestionData || game.gameState.secretQuestionData)
    ) {
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

  private static _validatePlayerHasSkipped(
    game: Game,
    currentPlayer: Player
  ): void {
    if (!game.hasPlayerSkipped(currentPlayer.meta.id)) {
      throw new ClientError(ClientResponse.PLAYER_NOT_SKIPPED);
    }
  }
}
