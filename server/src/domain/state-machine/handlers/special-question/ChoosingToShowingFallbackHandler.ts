import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  ChoosingToShowingFallbackCtx,
  ChoosingToShowingFallbackMutationData,
} from "domain/types/socket/transition/choosing";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";

/**
 * Fallback handler when a special question (secret/stake) is picked but
 * no eligible players exist. Skips special flow and shows the question
 * immediately to everyone.
 */
export class ChoosingToShowingFallbackHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.SHOWING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  public canTransition(ctx: ChoosingToShowingFallbackCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) return false;
    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.CHOOSING
      )
    ) {
      return false;
    }

    if (trigger !== TransitionTrigger.USER_ACTION) return false;

    try {
      const { question } = QuestionPickLogic.validateQuestionPick(
        game,
        payload.questionId
      );

      const isSpecial =
        question.type === PackageQuestionType.SECRET ||
        question.type === PackageQuestionType.STAKE;

      if (!isSpecial) return false;

      return !TransitionGuards.hasEligiblePlayers(game);
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToShowingFallbackCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: ChoosingToShowingFallbackCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionId
    );

    // Clear any stale special-question data and proceed as a normal question
    game.gameState.secretQuestionData = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.questionState = QuestionState.SHOWING;
    game.gameState.currentQuestion =
      GameQuestionMapper.mapToSimpleQuestion(question);

    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    return {
      data: {
        question: game.gameState.currentQuestion!,
        originalQuestionType: question.type,
      } satisfies ChoosingToShowingFallbackMutationData,
    };
  }

  protected async handleTimer(
    ctx: ChoosingToShowingFallbackCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    await this.gameService.clearTimer(ctx.game.id);

    const timerEntity = await this.timerService.setupQuestionTimer(
      ctx.game,
      GAME_QUESTION_ANSWER_TIME,
      QuestionState.SHOWING
    );

    return { timer: timerEntity.value() ?? undefined };
  }

  protected collectBroadcasts(
    _ctx: ChoosingToShowingFallbackCtx,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    // Personalized question data emission is handled by the socket handler
    // (similar to normal question flow), so no broadcasts here.
    return [];
  }
}
