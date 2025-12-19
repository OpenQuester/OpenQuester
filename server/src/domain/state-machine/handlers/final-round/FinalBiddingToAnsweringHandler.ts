import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
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
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
} from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundQuestionData } from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Handles transition from FINAL_BIDDING to FINAL_ANSWERING phase.
 *
 * This transition occurs when all eligible players have submitted their bids
 * (either manually, automatically due to low score, or via timeout/leave).
 *
 * Entry points that can trigger this:
 * - User submits bid (FinalRoundService.handleFinalBidSubmit)
 * - Player leaves during bidding (PlayerLeaveService.handleFinalBiddingPlayerLeave)
 * - Bidding timer expires (TimerExpirationService.handleBiddingExpiration)
 *
 * All three entry points now use this single handler through PhaseTransitionRouter.
 */
export class FinalBiddingToAnsweringHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_BIDDING;
  public readonly toPhase = GamePhase.FINAL_ANSWERING;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    super(gameService, timerService);
  }

  /**
   * Strict check for transition eligibility.
   *
   * Validates:
   * 1. Current phase must be FINAL_BIDDING (prevents re-triggering)
   * 2. Game in progress + final round + correct question/phase state
   * 3. All eligible bids must be submitted
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase (defensive check)
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round bidding
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.BIDDING,
        FinalRoundPhase.BIDDING
      )
    ) {
      return false;
    }

    // 3. All eligible players must have submitted bids
    return FinalRoundStateManager.areAllBidsSubmitted(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
    FinalRoundValidator.validateBiddingPhase(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Transition to answering phase
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);

    // Get question data for the remaining theme
    const questionData = this._getQuestionData(game);

    return {
      data: {
        questionData,
      },
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    // Clear the bidding timer
    await this.gameService.clearTimer(ctx.game.id);

    // Setup the answering timer (75 seconds for final round)
    const timerEntity = await this.timerService.setupFinalAnswerTimer(ctx.game);

    return {
      timer: timerEntity.value() ?? undefined,
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];
    const questionData = mutationResult.data
      ?.questionData as FinalRoundQuestionData;

    // 1. Emit question data so players can see the question
    if (questionData) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_QUESTION_DATA,
        data: {
          questionData,
        } satisfies FinalQuestionEventData,
        room: ctx.game.id,
      });
    }

    // 2. Emit phase complete event
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
      data: {
        phase: FinalRoundPhase.BIDDING,
        nextPhase: FinalRoundPhase.ANSWERING,
        timer: timerResult.timer,
      } satisfies FinalPhaseCompleteEventData,
      room: ctx.game.id,
    });

    return broadcasts;
  }

  /**
   * Get the question data for the remaining (non-eliminated) theme.
   */
  private _getQuestionData(game: Game): FinalRoundQuestionData | undefined {
    const handler = this.roundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;

    const remainingTheme = handler.getRemainingTheme(game);

    if (!remainingTheme?.questions?.[0]) {
      return undefined;
    }

    return {
      themeId: remainingTheme.id,
      themeName: remainingTheme.name,
      question: remainingTheme.questions[0],
    };
  }
}
