import { GameActionType } from "domain/enums/GameActionType";

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
}

/**
 * Result of action execution
 */
export interface GameActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
}
