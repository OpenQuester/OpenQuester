import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class SocketGameValidationService {
  /**
   * Validates that the player has showman role and throws error based on action
   */
  public validateShowmanRole(
    currentPlayer: Player | null,
    action: ShowmanAction
  ): void {
    if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
      switch (action) {
        case ShowmanAction.START:
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_START);
        case ShowmanAction.PAUSE:
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_PAUSE);
        case ShowmanAction.UNPAUSE:
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_UNPAUSE);
        case ShowmanAction.NEXT_ROUND:
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_NEXT_ROUND);
      }
    }
  }

  /**
   * Validates that player is showman and game is in progress
   */
  public validateGamePause(player: Player | null, game: Game): void {
    this.validateShowmanRole(player, ShowmanAction.PAUSE);
    GameStateValidator.validateGameInProgress(game);
  }

  /**
   * Validates that player is showman and game is in progress
   */
  public validateGameUnpause(player: Player | null, game: Game): void {
    this.validateShowmanRole(player, ShowmanAction.UNPAUSE);
    GameStateValidator.validateGameNotFinished(game);
    GameStateValidator.validateGameStarted(game);
  }

  /**
   * Validates that player is showman and game is in progress
   */
  public validateNextRound(player: Player | null, game: Game): void {
    this.validateShowmanRole(player, ShowmanAction.NEXT_ROUND);
    GameStateValidator.validateGameInProgress(game);
  }

  /**
   * Validates that player can perform question-related actions
   */
  public validateQuestionAction(
    currentPlayer: Player | null,
    game: Game,
    action: QuestionAction
  ): void {
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
      case QuestionAction.RESULT:
        if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_SEND_ANSWER_RESULT);
        }
        break;
      case QuestionAction.SKIP:
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
        // If simple round, restrict to showman or currentTurnPlayerId
        if (
          game.gameState.currentRound?.type === PackageRoundType.SIMPLE &&
          game.gameState.currentTurnPlayerId !== currentPlayer.meta.id &&
          currentPlayer?.role !== PlayerRole.SHOWMAN
        ) {
          throw new ClientError(ClientResponse.NOT_YOUR_TURN);
        }
        break;
    }
  }

  /**
   * Validates conditions for question answering
   */
  public validateQuestionAnswering(game: Game, currentPlayerId: number): void {
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

  /**
   * Validates that current round is set
   */
  public validateCurrentRound(game: Game): void {
    if (!game.gameState.currentRound) {
      // TODO: Should be ROUND_NOT_STARTED when lobby implemented
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }
  }

  /**
   * Validates question availability for picking
   */
  public validateQuestionPicking(game: Game): void {
    this.validateCurrentRound(game);

    if (game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PICKED);
    }
  }

  /**
   * Validates question skipping conditions
   */
  public validateQuestionSkipping(game: Game): void {
    this.validateCurrentRound(game);

    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }
  }

  public validateQuestionUnskipping(game: Game): void {
    this.validateCurrentRound(game);

    if (!game.gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_PICKED);
    }
  }

  /**
   * Validates conditions for final round answer submission
   */
  public validateFinalAnswerSubmission(
    game: Game,
    currentPlayer: Player | null
  ): void {
    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    if (currentPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.INSUFFICIENT_PERMISSIONS);
    }

    this.validateCurrentRound(game);

    // Check if it's a final round
    if (game.gameState.currentRound?.type !== PackageRoundType.FINAL) {
      throw new ClientError(ClientResponse.INVALID_ROUND_TYPE);
    }

    // Check if in answering phase
    if (game.gameState.questionState !== QuestionState.ANSWERING) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
  }
}
