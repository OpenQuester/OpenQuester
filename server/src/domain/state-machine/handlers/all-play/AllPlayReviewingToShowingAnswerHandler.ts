import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * ALL_PLAY_REVIEWING → SHOWING_ANSWER: every answer is ruled on. The right
 * answer is revealed; the results stay in `allPlay` until the next pick.
 */
export class AllPlayReviewingToShowingAnswerHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.ALL_PLAY_REVIEWING;
  public readonly toPhase = GamePhase.SHOWING_ANSWER;

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;
    if (getGamePhase(game) !== this.fromPhase) return false;
    return (
      (trigger === TransitionTrigger.CONDITION_MET && AllPlayLogic.allReviewed(game)) ||
      trigger === TransitionTrigger.USER_ACTION
    );
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;
    const questionData = ctx.resources?.questionWithTheme ?? null;
    const question = questionData?.question ?? null;

    if (question && questionData) {
      GameQuestionMapper.setQuestionPlayed(game, question.id!, questionData.theme.id!);
    }

    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    game.gameState.currentQuestion = null;
    game.gameState.questionContentPlan = null;
    game.gameState.answeredPlayers = null;
    game.gameState.skippedPlayers = null;
    game.gameState.answeringPlayer = null;
    game.gameState.answerShowData = {
      answerFiles: question?.answerFiles ?? null,
      answerText: question?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      answerContentPlan: ShowAnswerLogic.buildAnswerPlan(question),
      ...ShowAnswerLogic.credits(question)
    };

    return { data: { question } };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;
    const { question } = mutationResult.data as {
      question: Parameters<typeof ShowAnswerLogic.calculateShowAnswerDuration>[0];
    };
    const duration = ShowAnswerLogic.calculateShowAnswerDuration(question);
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

  protected collectBroadcasts(ctx: TransitionContext): BroadcastEvent[] {
    return [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: ctx.game.gameState.answerShowData as QuestionFinishEventPayload,
        room: ctx.game.id
      },
      {
        event: SocketIOGameEvents.ANSWER_SHOW_START,
        data: {} satisfies AnswerShowStartEventPayload,
        room: ctx.game.id
      }
    ];
  }
}
