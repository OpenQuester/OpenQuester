import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { TimerExpirationResult } from "domain/types/service/ServiceResult";
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
    private readonly logger: ILogger
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<TimerActionPayload>
  ): Promise<ActionHandlerResult<void>> {
    const { gameId, payload } = ctx.action;
    const { questionState } = payload;

    this.logger.debug(`Timer expiration for game ${gameId}`, {
      prefix: LogPrefix.TIMER,
      questionState,
    });

    const result = await this.handleTimerExpiration(gameId, questionState);

    if (!result.success) {
      return {
        success: false,
        error: "Timer expiration handling failed",
        mutations: [],
      };
    }

    const mutations = [
      ...DataMutationConverter.mutationFromServiceBroadcasts(result.broadcasts),
    ];

    // If game finished, add completion mutation instead of calling service directly
    if (result.game?.finishedAt) {
      mutations.push(DataMutationConverter.gameCompletionMutation(gameId));
    }

    return {
      success: true,
      mutations,
      broadcastGame: result.game,
    };
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
