import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
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
        case ShowmanAction.MANAGE_PLAYERS:
        case ShowmanAction.KICK_PLAYER:
        case ShowmanAction.CHANGE_SCORE:
        case ShowmanAction.CHANGE_TURN_PLAYER:
          throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_MANAGE_PLAYERS);
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
   * Validates that player can set ready state
   */
  public validatePlayerReadyState(player: Player | null, game: Game): void {
    // Only players (not showman or spectators) can set ready state
    if (!player || player.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.ONLY_PLAYERS_CAN_SET_READY);
    }

    // Cannot set ready state on a finished game
    GameStateValidator.validateGameNotFinished(game);

    // Can only set ready state before game starts
    if (ValueUtils.isValidDate(game.startedAt)) {
      throw new ClientError(ClientResponse.GAME_ALREADY_STARTED);
    }
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

  /**
   * Validates player management operations (restrict/ban/kick)
   */
  public validatePlayerManagement(currentPlayer: Player | null): void {
    this.validateShowmanRole(currentPlayer, ShowmanAction.MANAGE_PLAYERS);
  }

  /**
   * Validates player role change
   */
  public validatePlayerRoleChange(
    currentPlayer: Player | null,
    targetPlayer: Player | null,
    newRole: PlayerRole,
    game: Game
  ): void {
    if (!currentPlayer || !targetPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    const isSelfChange = currentPlayer.meta.id === targetPlayer.meta.id;

    if (isSelfChange) {
      // Validate self-role change
      this.validateSelfRoleChange(currentPlayer, newRole, game);
    } else {
      // Validate showman-initiated role change (existing behavior)
      this.validatePlayerManagement(currentPlayer);

      // Check if trying to change to showman when slot is taken
      if (newRole === PlayerRole.SHOWMAN && game.checkShowmanSlotIsTaken()) {
        throw new ClientError(ClientResponse.SHOWMAN_SLOT_TAKEN);
      }
    }

    // Common validation - cannot change to same role
    if (targetPlayer.role === newRole) {
      throw new ClientError(ClientResponse.INVALID_ROLE_CHANGE);
    }
  }

  /**
   * Validates self-role change
   */
  private validateSelfRoleChange(
    currentPlayer: Player,
    newRole: PlayerRole,
    game: Game
  ): void {
    // Check if restricted player is trying to change to non-spectator role
    if (currentPlayer.isRestricted && newRole !== PlayerRole.SPECTATOR) {
      throw new ClientError(ClientResponse.YOU_ARE_RESTRICTED);
    }

    // Check if banned player is trying to change role (shouldn't happen, but safety check)
    if (currentPlayer.isBanned) {
      throw new ClientError(ClientResponse.YOU_ARE_BANNED);
    }

    // Prevent role changes during active questions to avoid disrupting gameplay
    if (
      game.gameState?.currentQuestion &&
      game.gameState?.questionState === QuestionState.ANSWERING
    ) {
      throw new ClientError(ClientResponse.CANNOT_CHANGE_ROLE_WHILE_ANSWERING);
    }

    // Check if trying to become showman when slot is taken
    if (newRole === PlayerRole.SHOWMAN && game.checkShowmanSlotIsTaken()) {
      throw new ClientError(ClientResponse.SHOWMAN_SLOT_TAKEN);
    }

    // If changing to player role, check if there are available slots
    if (newRole === PlayerRole.PLAYER) {
      const activePlayers = game.players.filter(
        (p) =>
          p.role === PlayerRole.PLAYER &&
          p.gameStatus === PlayerGameStatus.IN_GAME &&
          p.meta.id !== currentPlayer.meta.id
      );

      if (activePlayers.length >= game.maxPlayers) {
        throw new ClientError(ClientResponse.GAME_IS_FULL);
      }
    }
  }

  /**
   * Validates player score change
   */
  public validatePlayerScoreChange(currentPlayer: Player | null): void {
    this.validateShowmanRole(currentPlayer, ShowmanAction.CHANGE_SCORE);
  }

  /**
   * Validates turn player change
   */
  public validateTurnPlayerChange(
    currentPlayer: Player,
    game: Game,
    newTurnPlayerId: number | null
  ): void {
    this.validateShowmanRole(currentPlayer, ShowmanAction.CHANGE_TURN_PLAYER);
    GameStateValidator.validateGameNotFinished(game);

    if (newTurnPlayerId !== null) {
      const targetPlayer = game.getPlayer(newTurnPlayerId, {
        fetchDisconnected: false,
      });
      if (!targetPlayer || targetPlayer.role !== PlayerRole.PLAYER) {
        throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
      }
    }
  }

  /**
   * Validates player slot change
   */
  public validatePlayerSlotChange(
    currentPlayer: Player,
    game: Game,
    targetSlot: number,
    targetPlayer: Player
  ): void {
    const isShowmanChange =
      targetPlayer.meta.id !== undefined &&
      targetPlayer.meta.id !== currentPlayer.meta.id;

    if (isShowmanChange) {
      this.validatePlayerManagement(currentPlayer);
    }
    // Target player must be a player (not showman or spectator)
    if (targetPlayer.role !== PlayerRole.PLAYER) {
      throw new ClientError(ClientResponse.ONLY_PLAYERS_CAN_CHANGE_SLOTS);
    }

    // Cannot change to same slot
    if (targetPlayer.gameSlot === targetSlot) {
      throw new ClientError(ClientResponse.CANNOT_CHANGE_TO_SAME_SLOT);
    }

    // Validate slot number (0-indexed slots consistent with Game entity)
    if (targetSlot < 0 || targetSlot >= game.maxPlayers) {
      throw new ClientError(ClientResponse.INVALID_SLOT_NUMBER);
    }

    // Check if slot is occupied
    const slotOccupied = game.players.some(
      (p) =>
        p.gameSlot === targetSlot &&
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME &&
        p.meta.id !== targetPlayer.meta.id
    );

    if (slotOccupied) {
      throw new ClientError(ClientResponse.SLOT_ALREADY_OCCUPIED);
    }
  }
}
