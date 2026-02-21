import { GameService } from "application/services/game/GameService";
import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ShowingToShowingAnswerMutationData } from "domain/types/socket/transition/showing";

/**
 * Handles transition from SHOWING to SHOWING_ANSWER when no one answers.
 *
 * Triggered by:
 * - Showing timer expiration (no buzz)
 * - Showman force skip
 * - All players skipped
 */
export class ShowingToShowingAnswerHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING;
  public readonly toPhase = GamePhase.SHOWING_ANSWER;

  constructor(
    gameService: GameService,
    private readonly packageStore: PackageStore
  ) {
    super(gameService);
  }

  /**
   * Only allow transition in regular round showing state when one of the
   * supported triggers occurs.
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    if (
      !TransitionGuards.canTransitionInRegularRound(game, QuestionState.SHOWING)
    ) {
      return false;
    }

    switch (trigger) {
      case TransitionTrigger.TIMER_EXPIRED:
      case TransitionTrigger.USER_ACTION:
        return true;
      case TransitionTrigger.CONDITION_MET:
        return game.haveAllPlayersSkipped();
      default:
        return false;
    }
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    let question: PackageQuestionDTO | null = null;
    const currentQuestion = game.gameState.currentQuestion;

    // TODO: Similar structure found among other files, can be moved to mapper
    if (currentQuestion) {
      const questionData = await this.packageStore.getQuestionWithTheme(
        game.id,
        currentQuestion.id!
      );

      if (questionData) {
        question = questionData.question;
        GameQuestionMapper.setQuestionPlayed(
          game,
          question.id!,
          questionData.theme.id!
        );
      }
    }

    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    game.gameState.currentQuestion = null;
    game.gameState.answeredPlayers = null;
    game.gameState.skippedPlayers = null;
    game.gameState.answeringPlayer = null;

    return {
      data: {
        question,
      } satisfies ShowingToShowingAnswerMutationData,
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;
    const mutationData =
      mutationResult.data as ShowingToShowingAnswerMutationData;
    const question = mutationData.question;

    // Calculate duration based on answer files (media stacking) or fallback default
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
          pxTtl: duration,
        },
      ],
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const mutationData =
      mutationResult.data as ShowingToShowingAnswerMutationData;
    const { game } = ctx;
    const question = mutationData.question;

    const broadcasts: BroadcastEvent[] = [];

    broadcasts.push({
      event: SocketIOGameEvents.QUESTION_FINISH,
      data: {
        answerFiles: question?.answerFiles ?? null,
        answerText: question?.answerText ?? null,
        nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      } satisfies QuestionFinishEventPayload,
      room: game.id,
    });

    broadcasts.push({
      event: SocketIOGameEvents.ANSWER_SHOW_START,
      data: {} satisfies AnswerShowStartEventPayload,
      room: game.id,
    });

    return broadcasts;
  }
}
