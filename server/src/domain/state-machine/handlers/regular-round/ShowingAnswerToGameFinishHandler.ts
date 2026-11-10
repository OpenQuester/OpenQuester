import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
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
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowEndEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Finish after the last regular answer or the final answer media reveal.
 */
export class ShowingAnswerToGameFinishHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING_ANSWER;
  public readonly toPhase = GamePhase.GAME_FINISHED;

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (trigger !== TransitionTrigger.TIMER_EXPIRED && trigger !== TransitionTrigger.USER_ACTION) {
      return false;
    }

    if (TransitionGuards.isFinalRound(game)) {
      return !!game.gameState.answerShowData;
    }

    const isRoundFinished = game.isRoundOver();
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
      data: {}
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Explicitly set timer to null in game state
    ctx.game.gameState.timer = null;

    return {
      timer: undefined,
      timerMutations: [{ op: "delete", key: timerKey(ctx.game.id) }]
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    if (TransitionGuards.isFinalRound(ctx.game)) {
      return [{ event: SocketIOGameEvents.GAME_FINISHED, data: true, room: ctx.game.id }];
    }
    return [
      {
        event: SocketIOGameEvents.ANSWER_SHOW_END,
        data: {} satisfies AnswerShowEndEventPayload,
        room: ctx.game.id
      },
      {
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: ctx.game.id
      }
    ];
  }
}
