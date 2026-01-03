import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { FinalSubmitEndEventData } from "domain/types/socket/events/FinalRoundEventData";
import { AnswerReviewData } from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from FINAL_ANSWERING to FINAL_REVIEWING phase.
 *
 * This transition occurs when all eligible players have submitted their answers
 * (either manually or via timeout/leave).
 *
 * Entry points that can trigger this:
 * - User submits answer (FinalRoundService.handleFinalAnswerSubmit)
 * - Player leaves during answering (PlayerLeaveService.handleAnsweringPlayerLeave)
 * - Answering timer expires (TimerExpirationService.handleFinalRoundAnsweringExpiration)
 */
export class FinalAnsweringToReviewingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_ANSWERING;
  public readonly toPhase = GamePhase.FINAL_REVIEWING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  /**
   * Strict check for transition eligibility.
   *
   * Validates:
   * 1. Current phase must be FINAL_ANSWERING
   * 2. Game in progress + final round + correct question/phase state
   * 3. All eligible answers must be submitted
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round answering
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.ANSWERING,
        FinalRoundPhase.ANSWERING
      )
    ) {
      return false;
    }

    // 3. All eligible players must have submitted answers
    return FinalRoundStateManager.areAllAnswersSubmitted(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
    FinalRoundValidator.validateAnsweringPhase(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Transition to reviewing phase
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);

    // Get all reviews for showman
    const allReviews =
      FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game);

    // Check if all answers are already reviewed (all auto-loss)
    const allAnswersReviewed =
      FinalRoundStateManager.areAllAnswersReviewed(game);

    return {
      data: {
        allReviews,
        allAnswersReviewed,
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Clear the answering timer (no timer for reviewing phase)
    await this.gameService.clearTimer(ctx.game.id);

    return {};
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];
    const allReviews = mutationResult.data?.allReviews as
      | AnswerReviewData[]
      | undefined;
    const allAnswersReviewed = mutationResult.data
      ?.allAnswersReviewed as boolean;

    // Emit phase completion event with all reviews
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_SUBMIT_END,
      data: {
        phase: FinalRoundPhase.ANSWERING,
        // If all answers already reviewed (all auto-loss), game will finish immediately
        nextPhase: allAnswersReviewed ? undefined : FinalRoundPhase.REVIEWING,
        allReviews,
      } satisfies FinalSubmitEndEventData,
      room: ctx.game.id,
    });

    return broadcasts;
  }
}
