import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { FINAL_ROUND_THEME_ELIMINATION_TIME } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
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
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowEndEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { ShowingAnswerToThemeEliminationMutationData } from "domain/types/socket/transition/showing";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { ServerError } from "domain/errors/ServerError";

/**
 * Handles transition from SHOWING_ANSWER to FINAL_THEME_ELIMINATION
 * when the last regular question was played and a final round exists.
 */
export class ShowingAnswerToThemeEliminationHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.SHOWING_ANSWER;
  public readonly toPhase = GamePhase.FINAL_THEME_ELIMINATION;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory
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
    return nextRound?.type === PackageRoundType.FINAL;
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    const progressionResult = await roundHandler.handleRoundProgression(game);

    const nextGameState = progressionResult.nextGameState;

    if (!nextGameState) {
      // Null-check, should not happen ever since we have nextRound guard check
      throw new ServerError(
        "No next game state after showing answer to theme elimination transition"
      );
    }

    // handleRoundProgression sets game.gameState; ensure state is final theme elimination
    if (game.gameState.questionState !== QuestionState.THEME_ELIMINATION) {
      game.setQuestionState(QuestionState.THEME_ELIMINATION);
    }

    return {
      data: {
        nextGameState,
      } satisfies ShowingAnswerToThemeEliminationMutationData,
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Clear any existing timer from the previous phase
    await this.gameService.clearTimer(game.id);

    // Setup timer for theme elimination (per-player turn timer)
    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      FINAL_ROUND_THEME_ELIMINATION_TIME
    );

    return {
      timer: timerEntity.value() ?? undefined,
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const mutationData =
      mutationResult.data as ShowingAnswerToThemeEliminationMutationData;

    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.ANSWER_SHOW_END,
        data: {} satisfies AnswerShowEndEventPayload,
        room: ctx.game.id,
      },
    ];

    if (mutationData.nextGameState) {
      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: {
          gameState: mutationData.nextGameState,
        } satisfies GameNextRoundEventPayload,
        room: ctx.game.id,
      });
    }

    return broadcasts;
  }
}
