import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  type MutationResult,
  type TimerResult,
  type TransitionContext
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import type { BroadcastEvent } from "domain/types/service/ServiceResult";
import type { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/** Release the final answer files only after the last ruling. */
export class FinalReviewingToShowingAnswerHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_REVIEWING;
  public readonly toPhase = GamePhase.SHOWING_ANSWER;

  public canTransition(ctx: TransitionContext): boolean {
    return (
      getGamePhase(ctx.game) === this.fromPhase &&
      !!ctx.resources?.finalRoundFullQuestion?.answerFiles?.length &&
      FinalRoundStateManager.areAllAnswersReviewed(ctx.game)
    );
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const question = ctx.resources!.finalRoundFullQuestion!;
    ctx.game.gameState.answerShowData = {
      answerText: question.answerText ?? null,
      answerFiles: question.answerFiles ?? null,
      nextTurnPlayerId: null,
      answerContentPlan: ShowAnswerLogic.buildAnswerPlan(question),
      ...ShowAnswerLogic.revealDetails(question)
    };
    ctx.game.setQuestionState(QuestionState.SHOWING_ANSWER);
    return { data: {} };
  }

  protected async handleTimer(ctx: TransitionContext): Promise<TimerResult> {
    const duration = ShowAnswerLogic.calculateShowAnswerDuration(
      ctx.resources!.finalRoundFullQuestion!
    );
    const timer = new GameStateTimer(duration).start();
    ctx.game.gameState.timer = timer;
    return {
      timer,
      timerMutations: [
        { op: "set", key: timerKey(ctx.game.id), value: JSON.stringify(timer), pxTtl: duration }
      ]
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    _result: MutationResult,
    { timer }: TimerResult
  ): BroadcastEvent<QuestionFinishEventPayload>[] {
    return [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        room: ctx.game.id,
        data: { ...ctx.game.gameState.answerShowData!, timer }
      }
    ];
  }
}
