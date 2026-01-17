import { TransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  TransitionContext,
  TransitionResult,
  getGamePhase,
} from "domain/state-machine/types";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Routes transition requests to the correct handler based on current phase
 * and game conditions.
 *
 * This is the SINGLE ENTRY POINT for all phase transitions in the game.
 * It ensures consistent behavior regardless of how a transition is triggered
 * (user action, timer expiration, player leaving, etc.).
 *
 * IMPORTANT: This router does NOT handle game persistence. The caller is
 * responsible for saving the game after a successful transition if needed.
 * This allows the caller to batch the save with other operations.
 */
export class PhaseTransitionRouter {
  /** Handlers grouped by their fromPhase for efficient lookup */
  private readonly handlersByPhase: Map<GamePhase, TransitionHandler[]> =
    new Map();

  constructor(private readonly logger: ILogger, handlers: TransitionHandler[]) {
    this.registerHandlers(handlers);
  }

  /**
   * Attempt to transition from current phase.
   * Finds the first handler whose canTransition() returns true and executes it.
   *
   * @param ctx The transition context containing game state and trigger info
   * @returns TransitionResult if a transition occurred, null otherwise
   */
  public async tryTransition<TPayload extends Record<string, unknown>>(
    ctx: TransitionContext<TPayload>
  ): Promise<TransitionResult | null> {
    const currentPhase = getGamePhase(ctx.game);
    const handlers = this.handlersByPhase.get(currentPhase) || [];

    if (handlers.length === 0) {
      this.logger.error(`No handlers registered for phase ${currentPhase}`, {
        prefix: LogPrefix.STATE_MACHINE,
      });
      return null;
    }

    // Find first handler that can handle this transition
    for (const handler of handlers) {
      if (!handler.canTransition(ctx)) {
        continue;
      }

      this.logger.trace(
        `Executing transition: ${handler.fromPhase} -> ${handler.toPhase} (trigger: ${ctx.trigger})`,
        {
          prefix: LogPrefix.STATE_MACHINE,
          gameId: ctx.game.id,
          trigger: ctx.trigger,
          triggeredBy: ctx.triggeredBy,
        }
      );

      try {
        const result = await handler.execute(ctx);

        this.logger.trace(
          `Transition completed: ${handler.fromPhase} -> ${handler.toPhase}`,
          {
            prefix: LogPrefix.STATE_MACHINE,
            gameId: ctx.game.id,
            broadcastCount: result.broadcasts.length,
          }
        );

        return result;
      } catch (error) {
        this.logger.error(
          `Transition failed: ${handler.fromPhase} -> ${handler.toPhase}: ${error}`,
          {
            prefix: LogPrefix.STATE_MACHINE,
            gameId: ctx.game.id,
            error,
          }
        );
        throw error;
      }
    }

    this.logger.trace(
      `No transition possible from phase ${currentPhase} (${handlers.length} handlers checked)`,
      {
        prefix: LogPrefix.STATE_MACHINE,
        gameId: ctx.game.id,
        trigger: ctx.trigger,
      }
    );

    return null;
  }

  /**
   * Check if any transition is possible from current phase without executing it.
   * Useful for pre-checking before performing actions.
   */
  public canTransition<
    TPayload extends Record<string, unknown> = Record<string, unknown>
  >(ctx: TransitionContext<TPayload>): boolean {
    const currentPhase = getGamePhase(ctx.game);
    const handlers = this.handlersByPhase.get(currentPhase) || [];

    return handlers.some((handler) => handler.canTransition(ctx));
  }

  /**
   * Register handlers, grouping them by fromPhase.
   */
  private registerHandlers(handlers: TransitionHandler[]): void {
    for (const handler of handlers) {
      const existing = this.handlersByPhase.get(handler.fromPhase) || [];
      existing.push(handler);
      this.handlersByPhase.set(handler.fromPhase, existing);

      this.logger.debug(
        `Registered handler: ${handler.fromPhase} -> ${handler.toPhase}`,
        { prefix: LogPrefix.STATE_MACHINE }
      );
    }

    this.logger.debug(
      `PhaseTransitionRouter initialized with ${handlers.length} handlers`,
      { prefix: LogPrefix.STATE_MACHINE }
    );
  }
}
