import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import {
  GamePhase,
  MutationResult,
  TimerResult,
  TransitionContext,
  TransitionResult,
} from "domain/state-machine/types";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * Interface for transition handlers.
 * Each handler is responsible for ONE specific phase transition.
 */
export interface TransitionHandler {
  /** Source phase this handler transitions FROM */
  readonly fromPhase: GamePhase;

  /** Target phase this handler transitions TO */
  readonly toPhase: GamePhase;

  /**
   * Check if this transition should happen given current game state.
   * Multiple handlers can exist for the same fromPhase - first matching wins.
   *
   * @returns true if this handler should execute the transition
   */
  canTransition(ctx: TransitionContext): boolean;

  /**
   * Execute the transition.
   * Should NOT save the game - the router handles persistence.
   *
   * Flow:
   * 1. Validate pre-conditions (throw if invalid)
   * 2. Mutate game state
   * 3. Handle timers (clear old, setup new)
   * 4. Collect and return broadcasts
   */
  execute(ctx: TransitionContext): Promise<TransitionResult>;
}

/**
 * Abstract base class providing common structure for transition handlers.
 * Implements the template method pattern for consistent execution flow.
 */
export abstract class BaseTransitionHandler implements TransitionHandler {
  abstract readonly fromPhase: GamePhase;
  abstract readonly toPhase: GamePhase;

  constructor(
    protected readonly gameService: GameService,
    protected readonly timerService: SocketQuestionStateService
  ) {
    //
  }

  abstract canTransition(ctx: TransitionContext): boolean;

  /**
   * Template method implementing the standard transition flow.
   */
  public async execute(ctx: TransitionContext): Promise<TransitionResult> {
    // 1. Validate pre-conditions
    this.validate(ctx);

    // 2. Execute state mutations
    const mutationResult = await this.mutate(ctx);

    // 3. Handle timers (clear old, setup new if needed)
    const timerResult = await this.handleTimer(ctx, mutationResult);

    // 4. Collect broadcasts
    const broadcasts = this.collectBroadcasts(ctx, mutationResult, timerResult);

    // 5. Build and return result
    return {
      success: true,
      fromPhase: this.fromPhase,
      toPhase: this.toPhase,
      game: ctx.game,
      broadcasts,
      data: {
        ...mutationResult.data,
        timer: timerResult.timer,
      },
    };
  }

  /**
   * Override to add validation logic.
   * Throw ClientError or ServerError if validation fails.
   */
  protected validate(_ctx: TransitionContext): void {
    // Default: no validation
  }

  /**
   * Override to implement state mutations.
   * This is where the actual game state changes happen.
   */
  protected abstract mutate(ctx: TransitionContext): Promise<MutationResult>;

  /**
   * Override to customize timer handling.
   * Default implementation clears any existing timer.
   */
  protected async handleTimer(
    ctx: TransitionContext,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    await this.gameService.clearTimer(ctx.game.id);
    return { timer: undefined };
  }

  /**
   * Override to define which broadcasts should be emitted for this transition.
   */
  protected abstract collectBroadcasts(
    ctx: TransitionContext,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[];
}
