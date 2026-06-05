import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { timerKey } from "domain/constants/redisKeys";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { TimerActionPayload } from "domain/types/action/TimerActionPayload";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { TimerExpirationResult } from "domain/types/service/ServiceResult";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Handles timer expiration events.
 * Routes timer expirations to appropriate handlers based on question state.
 */
export class TimerExpirationUseCase
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

    const skipReason = this.getTimerSkipReason(ctx);

    if (skipReason) {
      this.logger.debug(`Skipping stale timer action for game ${gameId}`, {
        prefix: LogPrefix.TIMER,
        gameId,
        timerKey: payload.timerKey,
        payloadQuestionState: questionState,
        currentQuestionState: ctx.game.gameState.questionState,
        reason: skipReason,
      });

      return {
        success: true,
        mutations: [],
      };
    }

    this.logger.debug(`Timer expiration for game ${gameId}`, {
      prefix: LogPrefix.TIMER,
      questionState,
    });

    const result = await this._handleTimerExpiration(gameId, questionState);

    if (!result.success) {
      return {
        success: false,
        error: "Timer expiration handling failed",
        mutations: [],
      };
    }

    const mutations = [
      ...DataMutationConverter.mutationFromTimerMutations(
        result.timerMutations
      ),
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

  private async _handleTimerExpiration(
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
        this.logger.debug(`Skipping timer expiration for inactive question state`, {
          prefix: LogPrefix.TIMER,
          questionState,
        });
        return { success: true, broadcasts: [] };
    }
  }

  private getTimerSkipReason(
    ctx: ActionExecutionContext<TimerActionPayload>
  ): string | null {
    const { game, action } = ctx;
    const { payload } = action;

    if (payload.timerKey !== timerKey(action.gameId)) {
      return "non-active-timer-key";
    }

    if (game.gameState.isPaused) {
      return "game-paused";
    }

    if (!game.gameState.timer) {
      return "no-active-timer";
    }

    if (!this.isHandledTimerState(payload.questionState)) {
      return "unsupported-question-state";
    }

    if (game.gameState.questionState !== payload.questionState) {
      return "question-state-changed";
    }

    if (
      this.didActiveTimerStartAfterExpiration(
        game.gameState.timer,
        payload.expirationTime
      )
    ) {
      return "newer-active-timer";
    }

    return null;
  }

  private isHandledTimerState(questionState: QuestionState | null): boolean {
    switch (questionState) {
      case QuestionState.MEDIA_DOWNLOADING:
      case QuestionState.SHOWING:
      case QuestionState.SHOWING_ANSWER:
      case QuestionState.ANSWERING:
      case QuestionState.THEME_ELIMINATION:
      case QuestionState.BIDDING:
      case QuestionState.SECRET_TRANSFER:
        return true;
      default:
        return false;
    }
  }

  private didActiveTimerStartAfterExpiration(
    timer: GameStateTimerDTO,
    expirationTime: Date
  ): boolean {
    const expirationMs = new Date(expirationTime).getTime();
    const latestTimerStart = timer.resumedAt ?? timer.startedAt;
    const latestTimerStartMs = new Date(latestTimerStart).getTime();

    if (!Number.isFinite(expirationMs) || !Number.isFinite(latestTimerStartMs)) {
      return false;
    }

    return latestTimerStartMs > expirationMs;
  }
}
