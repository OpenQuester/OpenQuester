import { type Game } from "domain/entities/game/Game";
import { type DataMutation } from "domain/types/action/DataMutation";

/**
 * Unified result interface returned by all action handlers.
 *
 * Handlers declare **what happened** (`success`, `data`, `error`) and
 * **what should change** (`mutations`). The {@link DataMutationProcessor}
 * takes the mutations and executes them (Redis pipeline, broadcasts,
 * game completion) — handlers never do I/O for persistence or broadcasting.
 *
 * @template TData - Handler-specific response data returned to the caller
 */
export interface ActionHandlerResult<TData = unknown> {
  /** Whether the action executed successfully */
  success: boolean;

  /** Handler-specific response data (returned to socket handler / caller) */
  data?: TData;

  /** Error message when success is false */
  error?: string;

  /**
   * Ordered list of data mutations to apply.
   * Processed by the executor's {@link DataMutationProcessor}:
   *   1. SAVE_GAME + TIMER_SET + TIMER_DELETE → batched into OUT pipeline
   *   2. BROADCAST → emitted after pipeline completes
   *   3. GAME_COMPLETION → executed after broadcasts
   */
  mutations: DataMutation[];

  /**
   * Game entity used for broadcast role filtering.
   *
   * Relevant when the handler delegates to a service that saves the game
   * internally (so no SAVE_GAME mutation), but broadcasts still need the
   * updated game for role-based filtering.
   *
   * Resolution order in the processor:
   *   1. This field (if set)
   *   2. Game from the last SAVE_GAME mutation
   *   3. ctx.game (fallback)
   */
  broadcastGame?: Game;
}
