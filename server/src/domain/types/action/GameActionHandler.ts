import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction, GameActionResult } from "domain/types/action/GameAction";

/**
 * Result of action handler execution.
 * Includes broadcasts that should be emitted after successful execution.
 */
export interface GameActionHandlerResult<TData = unknown>
  extends GameActionResult<TData> {
  /** Broadcasts to emit after successful execution */
  broadcasts?: SocketEventBroadcast[];
  /** Game ID for broadcast targeting (if different from action.gameId) */
  broadcastGameId?: string;
}

/**
 * Interface for stateless game action handlers.
 *
 * These handlers are registered once at startup and can execute any action
 * of their type regardless of which server instance receives the queued action.
 *
 * Key design principles:
 * - Stateless: All context comes from the GameAction
 * - No socket reference: Use action.socketId for error emission
 * - Pure execution: Returns result + broadcasts, executor handles emission
 */
export interface GameActionHandler<TPayload = unknown, TResult = unknown> {
  /**
   * Execute the action logic.
   *
   * @param action The action to execute (contains all context)
   * @returns Result with optional broadcasts
   * @throws Error on failure (will be caught and emitted to original socket)
   */
  execute(
    action: GameAction<TPayload>
  ): Promise<GameActionHandlerResult<TResult>>;
}
