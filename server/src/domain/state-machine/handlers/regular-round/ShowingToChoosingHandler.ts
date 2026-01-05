import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
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
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { QuestionShowingExpirationLogic } from "domain/logic/timer/QuestionShowingExpirationLogic";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from SHOWING to CHOOSING when showing timer expires.
 *
 * Trigger sources: timer expiration only (no user action).
 */
export class ShowingToChoosingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING;
  public readonly toPhase = GamePhase.CHOOSING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    super(gameService, timerService);
  }

  public canTransition(ctx: TransitionContext): boolean {
    const { game, trigger } = ctx;

    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(game, QuestionState.SHOWING)
    ) {
      return false;
    }

    return trigger === TransitionTrigger.TIMER_EXPIRED;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Round progression check (after showing timeout)
    const isRoundFinished =
      QuestionShowingExpirationLogic.shouldProgressRound(game);
    let nextGameState: GameStateDTO | null = null;
    let isGameFinished = false;
    let questionForBroadcast = null;

    if (game.gameState.currentQuestion) {
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        game.gameState.currentRound!.id,
        game.gameState.currentQuestion.id!
      );
      questionForBroadcast = questionData?.question ?? null;
    }

    if (isRoundFinished) {
      const roundHandler = this.roundHandlerFactory.createFromGame(game);
      const progressionResult = await roundHandler.handleRoundProgression(
        game,
        { forced: false }
      );

      isGameFinished = progressionResult.isGameFinished;
      nextGameState = progressionResult.nextGameState;
    }

    // Reset state to choosing
    game.resetToChoosingState();

    return {
      data: {
        isRoundFinished,
        isGameFinished,
        nextGameState,
        question: questionForBroadcast,
      },
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
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const { game } = ctx;
    const broadcasts: BroadcastEvent[] = [];
    const question = mutationResult.data?.question as PackageQuestionDTO | null;

    if (question) {
      const questionBroadcast =
        QuestionShowingExpirationLogic.buildQuestionFinishBroadcast(
          game,
          question,
          game.id
        );
      broadcasts.push(questionBroadcast);
    }

    const isGameFinished = mutationResult.data?.isGameFinished as boolean;
    const nextGameState = mutationResult.data
      ?.nextGameState as GameStateDTO | null;

    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: game.id,
      });
      return broadcasts;
    }

    if (nextGameState) {
      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: { gameState: nextGameState },
        room: game.id,
      });
    }

    return broadcasts;
  }
}
