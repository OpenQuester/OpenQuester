import { GameService } from "application/services/game/GameService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Stateless action handler for timer expiration events.
 * Routes timer expirations to appropriate handlers based on question state.
 */
export class TimerExpirationActionHandler
  implements GameActionHandler<TimerActionPayload, void>
{
  constructor(
    private readonly gameService: GameService,
    private readonly timerExpirationService: TimerExpirationService,
    private readonly logger: ILogger
  ) {}

  public async execute(
    action: GameAction<TimerActionPayload>
  ): Promise<GameActionHandlerResult<void>> {
    const { gameId, payload } = action;
    const { questionState } = payload;

    this.logger.debug(`Timer expiration for game ${gameId}`, {
      prefix: LogPrefix.TIMER,
      questionState,
    });

    const result = await this.handleTimerExpiration(gameId, questionState);

    if (!result.success) {
      return { success: false, error: "Timer expiration handling failed" };
    }

    // Convert service broadcasts to SocketEventBroadcast format
    const broadcasts: SocketEventBroadcast<unknown>[] = result.broadcasts.map(
      (b) => ({
        event: b.event as SocketIOGameEvents,
        data: b.data,
        target: SocketBroadcastTarget.GAME,
        gameId: b.room,
      })
    );

    return { success: true, broadcasts };
  }

  private async handleTimerExpiration(
    gameId: string,
    questionState: QuestionState | null
  ): Promise<{
    success: boolean;
    broadcasts: Array<{ event: string; data: unknown; room: string }>;
  }> {
    switch (questionState) {
      case QuestionState.MEDIA_DOWNLOADING:
        return this.timerExpirationService.handleMediaDownloadExpiration(
          gameId
        );

      case QuestionState.SHOWING:
        return this.timerExpirationService.handleQuestionShowingExpiration(
          gameId
        );

      case QuestionState.SHOWING_ANSWER:
        return this.timerExpirationService.handleShowAnswerExpiration(gameId);

      case QuestionState.ANSWERING:
        return this.timerExpirationService.handleAnsweringExpiration(gameId);

      case QuestionState.THEME_ELIMINATION:
        return this.timerExpirationService.handleThemeEliminationExpiration(
          gameId
        );

      case QuestionState.BIDDING:
        return this.timerExpirationService.handleBiddingExpiration(gameId);

      default:
        this.logger.warn(`Unhandled question state: ${questionState}`, {
          prefix: LogPrefix.TIMER,
          questionState,
        });
        return { success: false, broadcasts: [] };
    }
  }
}
