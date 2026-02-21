import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";

/**
 * Interface for stateless game action handlers.
 *
 * All handlers receive an {@link ActionExecutionContext} with prefetched game,
 * player, and timer data (loaded in the executor's IN pipeline — 1 Redis RT).
 * They return an {@link ActionHandlerResult} with a `mutations: DataMutation[]`
 * array declaring all side effects. The {@link DataMutationProcessor} executes
 * these mutations via switch-case (Redis pipeline, broadcasts, game completion).
 *
 * Key design principles:
 * - Stateless: all context comes from the action + prefetched context
 * - No socket reference: use action.socketId for error emission
 * - Pure declaration: returns result + mutations, processor handles Redis I/O
 *
 * Handlers that need additional data (e.g. PackageStore) can fetch it
 * themselves — the cost is 1 extra RT per fetch. The processor handles
 * game persistence, timer mutations, and broadcasts automatically.
 */
export interface GameActionHandler<TPayload = unknown, TResult = unknown> {
  /**
   * Execute the action with prefetched context.
   *
   * @param ctx Rich context with prefetched game, player, timer, action object
   * @returns Result with mutations to be processed by DataMutationProcessor
   * @throws Error on failure (will be caught and emitted to original socket)
   */
  execute(
    ctx: ActionExecutionContext<TPayload>
  ): Promise<ActionHandlerResult<TResult>>;
}
