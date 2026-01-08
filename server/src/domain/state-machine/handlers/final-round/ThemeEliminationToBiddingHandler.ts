import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { FINAL_ROUND_BID_TIME } from "domain/constants/game";
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
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { FinalPhaseCompleteEventData } from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { ServerError } from "domain/errors/ServerError";

/**
 * Handles transition from FINAL_THEME_ELIMINATION to FINAL_BIDDING phase.
 *
 * This transition occurs when theme elimination is complete (only one theme remains).
 *
 * Entry points that can trigger this:
 * - User eliminates a theme (FinalRoundService.handleThemeEliminate)
 * - Theme elimination timer expires (TimerExpirationService.handleThemeEliminationExpiration)
 * - Player leaves during theme elimination (PlayerLeaveService)
 */
export class ThemeEliminationToBiddingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.FINAL_THEME_ELIMINATION;
  public readonly toPhase = GamePhase.FINAL_BIDDING;

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
   * 1. Current phase must be FINAL_THEME_ELIMINATION
   * 2. Game in progress + final round + correct question/phase state
   * 3. Theme elimination must be complete (only one theme remains)
   */
  public canTransition(ctx: TransitionContext): boolean {
    const { game } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Validate game state for final round theme elimination
    if (
      !TransitionGuards.canTransitionInFinalRound(
        game,
        QuestionState.THEME_ELIMINATION,
        FinalRoundPhase.THEME_ELIMINATION
      )
    ) {
      return false;
    }

    // 3. Theme elimination must be complete
    const finalRoundHandler = this._getFinalRoundHandler(game);
    return finalRoundHandler.isThemeEliminationComplete(game);
  }

  protected override validate(ctx: TransitionContext): void {
    GameStateValidator.validateGameInProgress(ctx.game);
    FinalRoundValidator.validateThemeEliminationPhase(ctx.game);
  }

  protected async mutate(ctx: TransitionContext): Promise<MutationResult> {
    const { game } = ctx;

    // Transition to bidding phase
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.BIDDING);

    return {
      data: {},
    };
  }

  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    // Clear the theme elimination timer
    await this.gameService.clearTimer(game.id);

    // Setup the bidding timer
    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      FINAL_ROUND_BID_TIME,
      QuestionState.BIDDING
    );

    return {
      timer: timerEntity.value() ?? undefined,
    };
  }

  protected collectBroadcasts(
    ctx: TransitionContext,
    _mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const broadcasts: BroadcastEvent[] = [];

    // Emit phase completion event
    broadcasts.push({
      event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
      data: {
        phase: FinalRoundPhase.THEME_ELIMINATION,
        nextPhase: FinalRoundPhase.BIDDING,
        timer: timerResult.timer,
      } satisfies FinalPhaseCompleteEventData,
      room: ctx.game.id,
    });

    return broadcasts;
  }

  /**
   * Gets the FinalRoundHandler from factory.
   */
  private _getFinalRoundHandler(game: Game): FinalRoundHandler {
    const handler = this.roundHandlerFactory.createFromGame(game);
    if (!(handler instanceof FinalRoundHandler)) {
      throw new ServerError("Expected FinalRoundHandler for final round");
    }
    return handler;
  }
}
