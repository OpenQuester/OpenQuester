import { Server as IOServer, Namespace } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameService } from "application/services/game/GameService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import {
  GAME_TTL_IN_SECONDS,
  SYSTEM_PLAYER_ID,
  SYSTEM_SOCKET_ID,
} from "domain/constants/game";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { TIMER_NSP } from "domain/constants/timer";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ErrorController } from "domain/errors/ErrorController";
import { GameAction, GameActionResult } from "domain/types/action/GameAction";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class TimerExpirationHandler implements RedisExpirationHandler {
  private _gameNsp?: Namespace;

  constructor(
    private readonly io: IOServer,
    private readonly gameService: GameService,
    private readonly actionExecutor: GameActionExecutor,
    private readonly timerExpirationService: TimerExpirationService,
    private readonly logger: ILogger
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${TIMER_NSP}:`);
  }

  public async handle(key: string): Promise<void> {
    const gameId = key.split(":")[1];

    if (!gameId) {
      this.logger.warn(`Invalid timer key format: ${key}`);
      return;
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );

    const questionState = game.gameState.questionState;
    const actionType = this.getTimerActionType(questionState);

    const action: GameAction<TimerActionPayload> = {
      id: ValueUtils.generateUUID(),
      type: actionType,
      gameId: gameId,
      playerId: SYSTEM_PLAYER_ID,
      socketId: SYSTEM_SOCKET_ID,
      timestamp: new Date(),
      payload: {
        timerKey: key,
        questionState: questionState,
        expirationTime: new Date(),
      },
    };

    const executeCallback = async (
      queuedAction: GameAction
    ): Promise<GameActionResult> => {
      try {
        await this.executeTimerExpiration(
          queuedAction.payload as TimerActionPayload
        );
        return { success: true };
      } catch (error) {
        const resolvedError = await ErrorController.resolveError(
          error,
          this.logger
        );
        this._gameNamespace.to(gameId).emit(SocketIOEvents.ERROR, {
          message: resolvedError.message,
        });
        return { success: false, error: resolvedError.message };
      }
    };

    await this.actionExecutor.submitAction(action, executeCallback);
  }

  private getTimerActionType(
    questionState: QuestionState | null
  ): GameActionType {
    switch (questionState) {
      case QuestionState.MEDIA_DOWNLOADING:
        return GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED;
      case QuestionState.SHOWING:
        return GameActionType.TIMER_QUESTION_SHOWING_EXPIRED;
      case QuestionState.ANSWERING:
        return GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED;
      case QuestionState.THEME_ELIMINATION:
        return GameActionType.TIMER_THEME_ELIMINATION_EXPIRED;
      case QuestionState.BIDDING:
        return GameActionType.TIMER_BIDDING_EXPIRED;
      default:
        return GameActionType.TIMER_QUESTION_SHOWING_EXPIRED;
    }
  }

  private async executeTimerExpiration(
    payload: TimerActionPayload
  ): Promise<void> {
    const gameId = payload.timerKey.split(":")[1];

    if (!gameId) {
      throw new Error(`Invalid timer key: ${payload.timerKey}`);
    }

    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );

    let result;

    switch (game.gameState.questionState) {
      case QuestionState.MEDIA_DOWNLOADING:
        result =
          await this.timerExpirationService.handleMediaDownloadExpiration(
            gameId
          );
        break;

      case QuestionState.SHOWING:
        result =
          await this.timerExpirationService.handleQuestionShowingExpiration(
            gameId
          );
        break;

      case QuestionState.ANSWERING:
        result = await this.timerExpirationService.handleAnsweringExpiration(
          gameId
        );
        break;

      case QuestionState.THEME_ELIMINATION:
        result =
          await this.timerExpirationService.handleThemeEliminationExpiration(
            gameId
          );
        break;

      case QuestionState.BIDDING:
        result = await this.timerExpirationService.handleBiddingExpiration(
          gameId
        );
        break;

      default:
        this.logger.debug("[TIMER_EXPIRATION]: No handler for question state", {
          gameId,
          questionState: game.gameState.questionState,
        });
        return;
    }

    // Broadcast all events returned by service
    for (const broadcast of result.broadcasts) {
      this._gameNamespace
        .to(broadcast.room)
        .emit(broadcast.event, broadcast.data);
    }
  }

  private get _gameNamespace() {
    if (!this._gameNsp) {
      this._gameNsp = this.io.of(SOCKET_GAME_NAMESPACE);
    }

    return this._gameNsp;
  }
}
