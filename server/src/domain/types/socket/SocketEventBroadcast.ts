import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";

export interface SocketEventBroadcast<T = unknown> {
  event: SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;
  data: T;
  target?: SocketBroadcastTarget;
  gameId?: string;
  socketId?: string;
  useRoleBasedBroadcast?: boolean;
}
