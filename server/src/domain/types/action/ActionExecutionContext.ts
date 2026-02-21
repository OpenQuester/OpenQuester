import { type Game } from "domain/entities/game/Game";
import { type Player } from "domain/entities/game/Player";
import { type GameAction } from "domain/types/action/GameAction";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { type SocketRedisUserData } from "domain/types/user/SocketRedisUserData";

/**
 * Rich context created at the start of action execution.
 * Contains all prefetched data needed by handlers — loaded in
 * the executor's IN pipeline (single Redis round-trip).
 *
 * Handlers read from this context instead of making their own Redis calls.
 */
export interface ActionExecutionContext<T> {
  /** The action being executed */
  action: GameAction<T>;

  /** Prefetched game entity (from HGETALL in IN pipeline) */
  game: Game;

  /** Current player resolved from game.getPlayer() — null if disconnected/absent */
  currentPlayer: Player | null;

  /** Active timer value (from GET timer:{gameId} in IN pipeline) — null if no active timer */
  timer: GameStateTimerDTO | null;

  /** Lock token for this execution (used in OUT pipeline for compare-and-delete) */
  lockToken: string;

  /** Prefetched socket session data (from HGETALL socket:session:{socketId} in IN pipeline) — null if not found or drained from queue */
  userData: SocketRedisUserData | null;
}

/**
 * A narrowed context where both `currentPlayer` and `userData` are guaranteed
 * to be non-null.
 */
export interface AuthenticatedActionContext<T>
  extends ActionExecutionContext<T> {
  currentPlayer: Player;
  userData: SocketRedisUserData;
}

/**
 * Describes a single timer Redis mutation to be applied in the OUT pipeline.
 *
 * Handlers return these instead of making direct Redis calls,
 * allowing the executor to batch all timer operations.
 */
export type TimerMutation = TimerSetMutation | TimerDeleteMutation;

/**
 * SET a timer key with PX (millisecond) expiration.
 * Equivalent to: `SET timer:{key} {value} PX {pxTtl}`
 */
export interface TimerSetMutation {
  readonly op: "set";
  /** Full Redis key (e.g. `timer:ABCD` or `timer:showing:ABCD`) */
  readonly key: string;
  /** Serialized timer JSON */
  readonly value: string;
  /** TTL in milliseconds */
  readonly pxTtl: number;
}

/**
 * DEL a timer key.
 * Equivalent to: `DEL timer:{key}`
 */
export interface TimerDeleteMutation {
  readonly op: "delete";
  /** Full Redis key to delete */
  readonly key: string;
}
