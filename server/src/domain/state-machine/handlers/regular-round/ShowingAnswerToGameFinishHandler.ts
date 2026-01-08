import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
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
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowEndEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from SHOWING_ANSWER to GAME_FINISHED when
 * this was the last question of the last regular round and the
 * package does not contain a final round.
 */
export class ShowingAnswerToGameFinishHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING_ANSWER;
  public readonly toPhase = GamePhase.GAME_FINISHED;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (!TransitionGuards.isSimpleRound(game)) {
      return false;
    }

    if (
      trigger !== TransitionTrigger.TIMER_EXPIRED &&
      trigger !== TransitionTrigger.USER_ACTION
    ) {
      return false;
    }

    const isRoundFinished = game.isAllQuestionsPlayed() ?? false;
    if (!isRoundFinished) {
      return false;
    }

    const nextRound = game.getNextRound();
    return nextRound === null;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    ctx.game.finish();

    return {
      data: {},
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    await this.gameService.clearTimer(ctx.game.id);
    return { timer: undefined };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    return [
      {
        event: SocketIOGameEvents.ANSWER_SHOW_END,
        data: {} satisfies AnswerShowEndEventPayload,
        room: ctx.game.id,
      },
      {
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: ctx.game.id,
      },
    ];
  }
}
