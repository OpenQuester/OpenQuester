import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from MEDIA_DOWNLOADING to SHOWING.
 *
 * This transition occurs when all active players have downloaded media
 * or when the media download timer expires (forces readiness).
 */
export class MediaDownloadingToShowingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.MEDIA_DOWNLOADING;
  public readonly toPhase = GamePhase.SHOWING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  /**
   * Eligible when:
   * - Current phase is MEDIA_DOWNLOADING in a regular round
   * - Trigger is USER_ACTION and all players ready, or TIMER_EXPIRED
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.MEDIA_DOWNLOADING
      )
    ) {
      return false;
    }

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      return true;
    }

    if (
      trigger === TransitionTrigger.USER_ACTION ||
      trigger === TransitionTrigger.PLAYER_LEFT
    ) {
      return MediaDownloadLogic.areAllPlayersReady(game);
    }

    return false;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game, trigger } = ctx;

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      MediaDownloadLogic.forceAllPlayersReady(game);
    }

    game.setQuestionState(QuestionState.SHOWING);

    return {
      data: {
        allPlayersReady: MediaDownloadLogic.areAllPlayersReady(game),
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    await this.gameService.clearTimer(game.id);

    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      GAME_QUESTION_ANSWER_TIME
    );

    return { timer: timerEntity.value() ?? undefined };
  }

  /**
   * No broadcasts here: MediaDownloadedActionHandler builds MEDIA_DOWNLOAD_STATUS
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
