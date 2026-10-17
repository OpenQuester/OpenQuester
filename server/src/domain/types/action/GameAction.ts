import { GameActionType } from "domain/enums/GameActionType";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";

/**
 * Core game action interface
 * Represents a single action that can be queued and executed
 */
export interface GameAction<TPayload = unknown> {
  id: string;
  type: GameActionType;
  gameId: string;
  playerId: number;
  socketId: string;
  timestamp: Date;
  payload: TPayload;
  userData?: SocketRedisUserData;
  /**
   * Set when an admin or moderator acts from the admin panel instead of a
   * player: showman-only actions accept it in place of the showman.
   */
  moderatorId?: number;
}

/**
 * Serialized action stored in Redis queue
 */
export interface SerializedGameAction {
  id: string;
  type: GameActionType;
  gameId: string;
  playerId: number;
  socketId: string;
  timestamp: string;
  payload: string;
  userData?: SocketRedisUserData;
  moderatorId?: number;
}

/**
 * Result of action execution
 */
export interface GameActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
}
