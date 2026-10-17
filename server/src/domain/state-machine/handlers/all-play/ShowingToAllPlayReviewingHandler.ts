import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
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
import { AllPlayReviewingEventPayload } from "domain/types/socket/events/game/AllPlayEventPayloads";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * SHOWING → ALL_PLAY_REVIEWING: every answer is in, or the answer time ran
 * out. Answers and stakes become visible and the showman rules on each.
 * Missing answers are wrong without a ruling.
 */
export class ShowingToAllPlayReviewingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING;
  public readonly toPhase = GamePhase.ALL_PLAY_REVIEWING;

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;
    if (!game.gameState.allPlay) {
      return false;
    }

    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      return true;
    }

    return trigger === TransitionTrigger.CONDITION_MET && AllPlayLogic.allAnswered(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;
    game.setQuestionState(QuestionState.REVIEWING);
    AllPlayLogic.startReview(game, ctx.resources?.questionWithTheme?.question ?? null);

    return {};
  }

  /** The showman reviews at their own pace */
  protected async handleTimer(ctx: TransitionContext): Promise<TimerResult> {
    ctx.game.gameState.timer = null;

    return { timerMutations: [{ op: "delete", key: timerKey(ctx.game.id) }] };
  }

  protected collectBroadcasts(ctx: TransitionContext): BroadcastEvent[] {
    return [
      {
        event: SocketIOGameEvents.ALL_PLAY_REVIEWING,
        data: { allPlay: ctx.game.gameState.allPlay! } satisfies AllPlayReviewingEventPayload,
        room: ctx.game.id
      }
    ];
  }
}
