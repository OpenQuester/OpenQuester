import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";
import {
  MEDIA_PLAYBACK_START_DELAY_MS,
  QUESTION_CONTENT_START_LEAD_MS
} from "domain/constants/game";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
  TransitionTrigger
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from MEDIA_DOWNLOADING to SHOWING.
 *
 * Direct picks wait for both media readiness and the opening deadline.
 * Legacy/special entries require readiness or the media timeout.
 */
export class MediaDownloadingToShowingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.MEDIA_DOWNLOADING;
  public readonly toPhase: GamePhase = GamePhase.SHOWING;

  /**
   * Eligible when:
   * - Current phase is MEDIA_DOWNLOADING in a regular round
   * - Direct picks: media is ready, the opening deadline passed, and the game is unpaused
   * - Legacy/special entries: USER_ACTION/PLAYER_LEFT with readiness, or TIMER_EXPIRED
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (
      game.gameState.isPaused ||
      Boolean(game.gameState.answeringPlayer) !== (this.toPhase === GamePhase.ANSWERING)
    ) {
      return false;
    }

    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (!TransitionGuards.canTransitionInRegularRound(game, QuestionState.MEDIA_DOWNLOADING)) {
      return false;
    }

    if (game.gameState.questionTransition) {
      return QuestionTransitionLogic.canShow(game);
    }

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      return true;
    }

    if (trigger === TransitionTrigger.USER_ACTION || trigger === TransitionTrigger.PLAYER_LEFT) {
      return MediaDownloadLogic.areAllPlayersReady(game);
    }

    return false;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game, trigger } = ctx;

    if (trigger === TransitionTrigger.TIMER_EXPIRED && !game.gameState.questionTransition) {
      MediaDownloadLogic.forceAllPlayersReady(game);
    }

    const gated = !!game.gameState.questionTransition;
    game.setQuestionState(
      this.toPhase === GamePhase.ANSWERING ? QuestionState.ANSWERING : QuestionState.SHOWING
    );
    QuestionContentPlanLogic.applyToGame(game);

    return {
      data: {
        gated,
        allPlayersReady: MediaDownloadLogic.areAllPlayersReady(game)
      }
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // The content timeline plays first, then the usual answer window.
    const durationMs = QuestionContentPlanLogic.questionTimerDuration(game);
    const delayMs = (mutationResult.data as { gated: boolean }).gated
      ? QUESTION_CONTENT_START_LEAD_MS
      : MEDIA_PLAYBACK_START_DELAY_MS;
    game.gameState.questionTransition = null;
    const timer = new GameStateTimer(durationMs);
    game.gameState.timer = timer.start(delayMs);

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: questionTransitionTimerKey(game.id) },
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: delayMs + durationMs
        }
      ]
    };
  }

  /**
   * No broadcasts here: MediaDownloadedUseCase builds MEDIA_DOWNLOAD_STATUS
   * using service result data to keep personalized payload intact.
   */
  protected collectBroadcasts(
    _ctx: TransitionContext,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    return [];
  }
}
