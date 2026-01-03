import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * Convert service-layer BroadcastEvent[] to handler-layer SocketEventBroadcast[].
 *
 * Services generate type-safe BroadcastEvent using `satisfies` for payload validation.
 * Handlers should use this converter to pass `data` through unchanged,
 * only mapping the format (room → gameId, adding target).
 *
 * @param broadcasts - BroadcastEvent array from service layer
 * @param gameId - Game ID (defaults to each broadcast's room if not provided)
 * @returns SocketEventBroadcast array for handler layer
 */
export function convertBroadcasts(
  broadcasts: BroadcastEvent[],
  gameId?: string
): SocketEventBroadcast[] {
  return broadcasts.map((b) => ({
    event: b.event,
    data: b.data,
    target: SocketBroadcastTarget.GAME,
    gameId: gameId ?? b.room,
    useRoleBasedBroadcast: b.roleFilter,
  }));
}

/**
 * Convert a single BroadcastEvent to SocketEventBroadcast.
 *
 * @param broadcast - Single BroadcastEvent from service layer
 * @param gameId - Game ID (defaults to broadcast's room if not provided)
 * @returns SocketEventBroadcast for handler layer
 */
export function convertBroadcast(
  broadcast: BroadcastEvent,
  gameId?: string
): SocketEventBroadcast {
  return {
    event: broadcast.event,
    data: broadcast.data,
    target: SocketBroadcastTarget.GAME,
    gameId: gameId ?? broadcast.room,
    useRoleBasedBroadcast: broadcast.roleFilter,
  };
}
