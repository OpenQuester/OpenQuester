import { io, type Socket } from "socket.io-client";

import { API_BASE_URL, api } from "../api/client";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts";
import { SERVER_EVENTS } from "./contracts";
import { useGameStore } from "./gameStore";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let socket: GameSocket | null = null;
/**
 * Manager-level listeners live on socket.io, which removeAllListeners() does
 * not reach, so each connection keeps its own disposer.
 */
let disposeManagerListeners: (() => void) | null = null;

export function connectToGame(
  gameId: string,
  role: "showman" | "player" | "spectator",
  password?: string | null,
) {
  disconnectFromGame();
  const store = useGameStore.getState();
  store.setConnection("connecting");
  const active = io(`${API_BASE_URL}/games`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
  socket = active;
  // SERVER_EVENTS is derived from the generated payload map, so a new server
  // event cannot be added without this client subscribing to it.
  for (const event of SERVER_EVENTS) {
    active.on(
      event as never,
      ((payload: unknown) =>
        useGameStore.getState().applyEvent(event, payload)) as never,
    );
  }
  const onReconnectAttempt = () =>
    useGameStore.getState().setConnection("reconnecting");
  active.io.on("reconnect_attempt", onReconnectAttempt);
  active.on("connect", async () => {
    try {
      const socketId = active.id;
      if (!socketId) return;
      await api.authenticateSocket(socketId);
      // The player may have left while the authenticate call was in flight.
      if (socket !== active || !active.connected) return;
      useGameStore.getState().setConnection("connected");
      active.emit("join", { gameId, role, password: password ?? null });
    } catch (error) {
      if (socket !== active) return;
      useGameStore.getState().applyEvent("error", {
        message:
          error instanceof Error ? error.message : "Authentication failed",
      });
      useGameStore.getState().setConnection("error");
    }
  });
  active.on("disconnect", () =>
    useGameStore.getState().setConnection("disconnected"),
  );
  disposeManagerListeners = () => {
    active.io.off("reconnect_attempt", onReconnectAttempt);
  };
  return active;
}

export function getGameSocket() {
  return socket;
}

export function disconnectFromGame() {
  if (!socket) return;
  disposeManagerListeners?.();
  disposeManagerListeners = null;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
