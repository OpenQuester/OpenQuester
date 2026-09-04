import type { components } from "../api/schema";
import type {
  GeneratedClientSocketPayloads,
  GeneratedServerSocketPayloads,
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
