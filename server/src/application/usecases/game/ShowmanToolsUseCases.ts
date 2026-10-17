import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { GameJoinMode } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  AnswerResultUndoEventPayload,
  BuzzerOpenEventPayload,
  GameJoinModeChangeEventPayload,
  GameJoinModeChangeInputData,
  QuestionRemoveRestoreEventPayload,
  QuestionRemoveRestoreInputData
} from "domain/types/socket/events/game/ShowmanToolsEventPayloads";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";

function requireShowman(ctx: ActionExecutionContext<unknown>): Game {
  GameStateValidator.validateGameNotFinished(ctx.game);

  if (ctx.currentPlayer?.role !== PlayerRole.SHOWMAN) {
    throw new ClientError(ClientResponse.ONLY_SHOWMAN_CAN_MANAGE_PLAYERS);
  }

  return ctx.game;
}

/** The showman removes a question from the board, or restores it */
export class QuestionRemoveRestoreUseCase implements GameActionHandler<
  QuestionRemoveRestoreInputData,
  QuestionRemoveRestoreEventPayload
> {
  public async execute(
    ctx: ActionExecutionContext<QuestionRemoveRestoreInputData>
  ): Promise<ActionHandlerResult<QuestionRemoveRestoreEventPayload>> {
    const game = requireShowman(ctx);
    const { questionId } = ctx.action.payload;
    const isPlayed = ShowmanToolsLogic.removeOrRestoreQuestion(game, questionId);
    const data: QuestionRemoveRestoreEventPayload = { questionId, isPlayed };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.QUESTION_REMOVE_RESTORE,
          data
        )
      ],
      broadcastGame: game
    };
  }
}

/** The showman takes back the last ruling on the current question */
export class RevertLastAnswerRulingUseCase implements GameActionHandler<
  EmptyInputData,
  AnswerResultUndoEventPayload
> {
  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<AnswerResultUndoEventPayload>> {
    const game = requireShowman(ctx);
    const data: AnswerResultUndoEventPayload = ShowmanToolsLogic.undoLastRuling(game);

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.ANSWER_RESULT_UNDO,
          data
        )
      ],
      broadcastGame: game
    };
  }
}

/** The showman opens or closes the game to newcomers */
export class GameJoinModeChangeUseCase implements GameActionHandler<
  GameJoinModeChangeInputData,
  GameJoinModeChangeEventPayload
> {
  public async execute(
    ctx: ActionExecutionContext<GameJoinModeChangeInputData>
  ): Promise<ActionHandlerResult<GameJoinModeChangeEventPayload>> {
    const game = requireShowman(ctx);
    const joinMode = ctx.action.payload.joinMode;
    game.gameState.joinMode = joinMode === GameJoinMode.OPEN ? null : joinMode;
    const data: GameJoinModeChangeEventPayload = { joinMode };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.GAME_JOIN_MODE_CHANGE,
          data
        )
      ],
      broadcastGame: game
    };
  }
}

/**
 * The showman opens the buzzer now instead of waiting for the question to
 * finish: a press from here on is not a false start, and running false-start
 * locks are lifted.
 */
export class BuzzerOpenUseCase implements GameActionHandler<
  EmptyInputData,
  BuzzerOpenEventPayload
> {
  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<BuzzerOpenEventPayload>> {
    const game = requireShowman(ctx);
    const { gameState } = game;
    const timer = gameState.timer;

    if (gameState.isPaused) {
      throw new ClientError(ClientResponse.GAME_IS_PAUSED);
    }

    if (
      gameState.questionState !== QuestionState.SHOWING ||
      gameState.answeringPlayer != null ||
      !timer
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const opensAt = gameState.buzzerOpensAtMs ?? 0;
    const elapsed = Math.floor(GamePauseLogic.calculateElapsedTime(timer));
    // Already open (or no false starts at all): nothing to change. Otherwise
    // keep it above 0, since 0 means "no false starts" to the clients.
    if (opensAt > elapsed) {
      gameState.buzzerOpensAtMs = Math.max(1, elapsed);
      gameState.buzzerLocks = null;
    }

    const data: BuzzerOpenEventPayload = { buzzerOpensAtMs: gameState.buzzerOpensAtMs ?? 0 };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(game.id, SocketIOGameEvents.BUZZER_OPEN, data)
      ],
      broadcastGame: game
    };
  }
}
