import { MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
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
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * ALL_PLAY_BIDDING → MEDIA_DOWNLOADING: every stake is in (or time ran out,
 * and missing stakes were filled). The question now preloads like any other.
 */
export class AllPlayBiddingToMediaDownloadingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.ALL_PLAY_BIDDING;
  public readonly toPhase = GamePhase.MEDIA_DOWNLOADING;

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (!ctx.resources?.questionWithTheme) {
      return false;
    }

    if (trigger === TransitionTrigger.TIMER_EXPIRED) {
      return true;
    }

    return trigger === TransitionTrigger.CONDITION_MET && AllPlayLogic.allStaked(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;
    const { question, theme } = ctx.resources!.questionWithTheme!;

    AllPlayLogic.fillMissingStakes(game);
    QuestionPickLogic.processNormalQuestionPick(game, question, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);

    return {};
  }

  protected async handleTimer(ctx: TransitionContext): Promise<TimerResult> {
    const { game } = ctx;
    const timer = new GameStateTimer(MEDIA_DOWNLOAD_TIMEOUT);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: MEDIA_DOWNLOAD_TIMEOUT
        }
      ]
    };
  }

  /** The question data goes out per role (the showman also gets the answer) */
  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    return [
      {
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: ctx.resources!.questionWithTheme!.question,
          timer: timerResult.timer!,
          questionEligiblePlayers: ctx.game.getQuestionEligiblePlayers()
        } satisfies GameQuestionDataEventPayload,
        room: ctx.game.id,
        roleFilter: true
      }
    ];
  }
}
