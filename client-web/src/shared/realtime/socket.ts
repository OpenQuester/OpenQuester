import { io, type Socket } from "socket.io-client";

import { API_BASE_URL, api } from "../api/client";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts";
import { useGameStore } from "./gameStore";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let socket: GameSocket | null = null;

const receiveEvents: Array<keyof ServerToClientEvents> = [
  "join",
  "game-data",
  "start",
  "user-leave",
  "question-data",
  "question-answer",
  "question-finish",
  "answer-submitted",
  "answer-result",
  "answer-show-start",
  "answer-show-end",
  "next-round",
  "game-finished",
  "game-pause",
  "game-unpause",
  "player-ready",
  "player-unready",
  "player-role-change",
  "score-changed",
  "turn-player-changed",
  "theme-eliminate",
  "final-bid-submit",
  "final-answer-submit",
  "final-answer-review",
  "final-phase-complete",
  "final-question-data",
  "final-submit-end",
  "final-auto-loss",
  "secret-question-picked",
  "secret-question-transfer",
  "stake-question-picked",
  "stake-bid-submit",
  "stake-question-winner",
  "media-download-status",
  "chat-message",
  "question-guidance",
  "error",
];

export function connectToGame(
  gameId: string,
  role: "showman" | "player" | "spectator",
  password?: string | null,
) {
  disconnectFromGame();
  const store = useGameStore.getState();
  store.setConnection("connecting");
  socket = io(`${API_BASE_URL}/games`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
  for (const event of receiveEvents) {
    socket.on(
      event as never,
      ((payload: unknown) =>
        useGameStore.getState().applyEvent(event, payload)) as never,
    );
  }
  socket.on("connect", async () => {
    try {
      await api.authenticateSocket(socket!.id!);
      useGameStore.getState().setConnection("connected");
      socket!.emit("join", { gameId, role, password: password ?? null });
    } catch (error) {
      useGameStore.getState().applyEvent("error", {
        message:
          error instanceof Error ? error.message : "Authentication failed",
      });
      useGameStore.getState().setConnection("error");
    }
  });
  socket.io.on("reconnect_attempt", () =>
    useGameStore.getState().setConnection("reconnecting"),
  );
  socket.on("disconnect", () =>
    useGameStore.getState().setConnection("disconnected"),
  );
  return socket;
}

export function getGameSocket() {
  return socket;
}
export function disconnectFromGame() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
