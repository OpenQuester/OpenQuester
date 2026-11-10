import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameService } from "application/services/game/GameService";
import { GAME_TTL_IN_SECONDS, SYSTEM_PLAYER_ID, SYSTEM_SOCKET_ID } from "domain/constants/game";
import { type Game } from "domain/entities/game/Game";
import { TIMER_NSP } from "domain/constants/timer";
import { GameActionType } from "domain/enums/GameActionType";
import { GamePhase, getGamePhase } from "domain/state-machine/types";
import { GameAction } from "domain/types/action/GameAction";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { ValueUtils } from "domain/utils/ValueUtils";
import { parseTimerKey, TimerKeyType } from "domain/utils/parseTimerKey";

/**
 * Handles timer expiration events from Redis keyspace notifications.
 *
 * This handler creates game actions for timer expirations and submits them
 * to the action executor. The actual execution logic is in TimerExpirationActionHandler
 * which is registered in the GameActionHandlerRegistry.
 *
 * This architecture enables distributed execution - any server instance can
 * pick up and process a queued timer action.
 */
@singleton()
export class TimerExpirationHandler implements RedisExpirationHandler {
  constructor(
    private readonly gameService: GameService,
    private readonly actionExecutor: GameActionExecutor,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${TIMER_NSP}:`);
  }

  public async handle(key: string): Promise<void> {
    const parsedKey = parseTimerKey(key);
    if (!parsedKey) {
      this.logger.warn(`Invalid timer key format: ${key}`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        key
      });
      return;
    }
    if (parsedKey.type === TimerKeyType.SAVED) {
      this.logger.debug(`Skipping non-active timer expiration`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        key
      });
      return;
    }

    const { gameId, type } = parsedKey;

    let game;
    try {
      game = await this.gameService.getGameEntity(gameId, GAME_TTL_IN_SECONDS);
    } catch {
      this.logger.warn(`Game not found for expired timer, skipping`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        gameId,
        key
      });
      return;
    }

    const questionState = game.gameState.questionState;
    const skipReason = this.getExpirationSkipReason(game, type);

    if (skipReason) {
      this.logger.debug(`Skipping stale timer expiration`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        gameId,
        key,
        questionState,
        reason: skipReason
      });
      return;
    }

    const actionType = this.getTimerActionType(game);

    if (!actionType) {
      this.logger.debug(`Skipping timer expiration for unsupported question state`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        gameId,
        key,
        questionState
      });
      return;
    }

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
        expirationTime: new Date()
      }
    };

    // Submit action - execution handled by registered TimerExpirationActionHandler
    await this.actionExecutor.submitAction(action);
  }

  private getExpirationSkipReason(game: Game, keyType: TimerKeyType): string | null {
    if (game.gameState.isPaused) {
      return "game-paused";
    }

    if (keyType === TimerKeyType.QUESTION_TRANSITION) {
      return game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING &&
        game.gameState.questionTransition
        ? null
        : "no-question-transition";
    }
    if (!game.gameState.timer) {
      return "no-active-timer";
    }

    return null;
  }

  private getTimerActionType(game: Game): GameActionType | null {
    const questionState = game.gameState.questionState;

    // Final answering shares ANSWERING question state, so phase decides its timer action.
    if (getGamePhase(game) === GamePhase.FINAL_ANSWERING) {
      return GameActionType.TIMER_FINAL_ANSWERING_EXPIRED;
    }

    switch (questionState) {
      case QuestionState.MEDIA_DOWNLOADING:
        return GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED;
      case QuestionState.SHOWING:
        return GameActionType.TIMER_QUESTION_SHOWING_EXPIRED;
      case QuestionState.SHOWING_ANSWER:
      case QuestionState.SECRET_TRANSFER:
        return GameActionType.TIMER_QUESTION_SHOWING_EXPIRED;
      case QuestionState.ANSWERING:
        return GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED;
      case QuestionState.THEME_ELIMINATION:
        return GameActionType.TIMER_THEME_ELIMINATION_EXPIRED;
      case QuestionState.BIDDING:
        return GameActionType.TIMER_BIDDING_EXPIRED;
      default:
        return null;
    }
  }
}
