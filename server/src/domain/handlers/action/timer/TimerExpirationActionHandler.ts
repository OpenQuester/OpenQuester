import { GameLifecycleService } from "application/services/game/GameLifecycleService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { TimerExpirationResult } from "domain/types/service/ServiceResult";
import { convertBroadcasts } from "domain/utils/BroadcastConverter";
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
    private readonly timerExpirationService: TimerExpirationService,
    private readonly gameLifecycleService: GameLifecycleService,
    private readonly logger: ILogger
  ) {
    //
  }

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

    // Service generates type-safe broadcasts with satisfies - just convert format
    const broadcasts = convertBroadcasts(result.broadcasts);

    // Check if game finished and trigger statistics persistence
    if (result.game?.finishedAt) {
      await this.gameLifecycleService.handleGameCompletion(gameId);
    }

    return { success: true, broadcasts };
  }

  private async handleTimerExpiration(
    gameId: string,
    questionState: QuestionState | null
  ): Promise<TimerExpirationResult> {
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

      case QuestionState.SECRET_TRANSFER:
        return this.timerExpirationService.handleSecretTransferExpiration(
          gameId
        );

      default:
        this.logger.warn(`Unhandled question state: ${questionState}`, {
          prefix: LogPrefix.TIMER,
          questionState,
        });
        return { success: false, broadcasts: [] };
    }
  }
}
