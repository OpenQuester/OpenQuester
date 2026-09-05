import type { components } from "../api/schema";
import {
  GENERATED_SERVER_SOCKET_EVENTS,
  type GeneratedClientSocketPayloads,
  type GeneratedServerSocketPayloads,
} from "./socket.generated";

export type Player = components["schemas"]["PlayerData"];
export type GameState = components["schemas"]["GameState"];
export type JoinSnapshot =
  components["schemas"]["SocketIOGameJoinEventPayload"];
export type ChatMessage =
  components["schemas"]["SocketIOChatMessageEventPayload"];

type EventHandlers<Payloads> = {
  [Event in keyof Payloads]: Payloads[Event] extends undefined
    ? () => void
    : (payload: Payloads[Event]) => void;
};

export type ClientToServerEvents = EventHandlers<GeneratedClientSocketPayloads>;
export type ServerToClientEvents = EventHandlers<GeneratedServerSocketPayloads>;

export type ServerEvent = keyof GeneratedServerSocketPayloads;
export type ServerPayload<Event extends ServerEvent> =
  GeneratedServerSocketPayloads[Event];

/**
 * Every event the server can send, straight from the generated map. Subscribing
 * from this list is what keeps a newly added server event from going unhandled.
 */
export const SERVER_EVENTS: readonly ServerEvent[] =
  GENERATED_SERVER_SOCKET_EVENTS;
