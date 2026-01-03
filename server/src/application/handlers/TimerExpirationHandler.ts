import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameService } from "application/services/game/GameService";
import {
  GAME_TTL_IN_SECONDS,
  SYSTEM_PLAYER_ID,
  SYSTEM_SOCKET_ID,
} from "domain/constants/game";
import { TIMER_NSP } from "domain/constants/timer";
import { GameActionType } from "domain/enums/GameActionType";
import { GameAction } from "domain/types/action/GameAction";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

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
    const gameId = key.split(":")[1];

    if (!gameId) {
      this.logger.warn(`Invalid timer key format: ${key}`, {
        prefix: LogPrefix.TIMER_EXPIRATION,
        key,
      });
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

    // Submit action - execution handled by registered TimerExpirationActionHandler
    await this.actionExecutor.submitAction(action);
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
}
