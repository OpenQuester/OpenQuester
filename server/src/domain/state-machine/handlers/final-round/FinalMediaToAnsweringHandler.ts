import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
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
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/** Start the final timeline only after readiness or its bounded timeout. */
export class FinalMediaToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_MEDIA_DOWNLOADING;
  public readonly toPhase = GamePhase.FINAL_ANSWERING;

  public canTransition(ctx: TransitionContext): boolean {
    return (
      getGamePhase(ctx.game) === this.fromPhase &&
      !ctx.game.gameState.isPaused &&
      (ctx.trigger === TransitionTrigger.TIMER_EXPIRED ||
        MediaDownloadLogic.areAllPlayersReady(ctx.game))
    );
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const data = ctx.game.gameState.finalRoundData!.questionData!;
    const timedOut = ctx.trigger === TransitionTrigger.TIMER_EXPIRED;
    delete data.mediaPreparationId;
    if (timedOut) data.mediaPreparationTimedOut = true;
    ctx.game.setQuestionState(QuestionState.ANSWERING);
    return { data: { timedOut } };
  }

  protected async handleTimer(ctx: TransitionContext): Promise<TimerResult> {
    const game = ctx.game;
    const contentMs = game.gameState.finalRoundData?.questionData?.contentPlan?.totalMs ?? 0;
    const duration = Math.max(
      1,
      contentMs +
        (FinalRoundStateManager.areAllAnswersSubmitted(game)
          ? 0
          : game.settings.timers.finalAnswerMs)
    );
    const timer = new GameStateTimer(duration);
    game.gameState.timer = timer.start();
    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: duration
        }
      ]
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    result: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const { timedOut } = result.data as { timedOut: boolean };
    return [
      {
        event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
        room: ctx.game.id,
        data: {
          playerId: SYSTEM_PLAYER_ID,
          mediaDownloaded: true,
          allPlayersReady: true,
          timer: timerResult.timer ?? null,
          contentPlan: ctx.game.gameState.finalRoundData?.questionData?.contentPlan ?? null,
          ...(timedOut ? { timedOut: true } : {})
        }
      },
      {
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        room: ctx.game.id,
        data: {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
          timer: timerResult.timer
        }
      }
    ];
  }
}
