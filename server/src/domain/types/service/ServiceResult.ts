import { Game } from "domain/entities/game/Game";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";

/**
 * Represents a broadcast event to be emitted
 */
export interface BroadcastEvent<T = unknown> {
  event: SocketIOGameEvents | SocketIOEvents;
  data: T;
  room: string;
  roleFilter?: boolean;
}

/**
 * Standard service result with broadcasts
 */
export interface ServiceResult<TData = unknown> {
  success: boolean;
  data?: TData;
  broadcasts: BroadcastEvent[];
  error?: string;
}

/**
 * Result from timer expiration handling
 */
export interface TimerExpirationResult extends ServiceResult {
  game?: Game;
  shouldContinue: boolean;
}
