import { create } from "zustand";

import { safeStorage } from "@/lib/storage";

import { reduce, sessionFromSnapshot, type GameSession } from "./reducer";
import type { ServerEvent } from "./protocol";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "failed";

export interface GameToast {
  id: number;
  kind: "error" | "info" | "success";
  text: string;
}

interface GameStore {
  gameId: string | null;
  session: GameSession | null;
  connection: ConnectionStatus;
  /** Set when the server refused the join (wrong password, full game, banned...). */
  joinError: string | null;
  /** Client action waiting for the server; drives the "waiting_for_server" state. */
  pending: { action: string; at: number } | null;
  toasts: GameToast[];
  /** Set once the local player left or was removed; the page navigates away. */
  left: { gameId: string; why: "left" | "kicked" | "deleted" | "closed" } | null;

  begin: (gameId: string) => void;
  dispatch: (event: ServerEvent) => void;
  setConnection: (status: ConnectionStatus) => void;
  setJoinError: (message: string | null) => void;
  setPending: (action: string | null) => void;
  toast: (kind: GameToast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  markLeft: (why: "left" | "kicked" | "deleted" | "closed") => void;
}

let toastId = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  session: null,
  connection: "idle",
  joinError: null,
  pending: null,
  toasts: [],
  left: null,

  begin: (gameId) =>
    set({
      gameId,
      session: null,
      connection: "connecting",
      joinError: null,
      pending: null,
      toasts: [],
      left: null,
    }),

  dispatch: (event) => {
    const { session, gameId } = get();
    if (event.type === "game-data") {
      // A snapshot replaces everything: no incremental patching after a gap.
      set({
        session: sessionFromSnapshot(gameId ?? "", event.payload),
        joinError: null,
        pending: null,
      });
      return;
    }
    if (!session) return;
    const next = reduce(session, event);
    if (next !== session) set({ session: next, pending: null });
  },

  setConnection: (connection) => set({ connection }),
  setJoinError: (joinError) => set({ joinError }),
  setPending: (action) => set({ pending: action ? { action, at: Date.now() } : null }),

  toast: (kind, text) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    window.setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markLeft: (why) => {
    const gameId = get().gameId;
    if (!gameId) return;
    set({ left: { gameId, why } });
    if (why === "left") rememberLeftGame(gameId);
  },
}));

// Lets end-to-end tests and devtools inspect the live game state.
if (typeof window !== "undefined") {
  (window as unknown as { __oqGame?: typeof useGameStore }).__oqGame = useGameStore;
}

const LEFT_KEY = "oq.leftGames";

/** Games this browser explicitly left; the home page stops offering to rejoin them. */
export function leftGames(): string[] {
  try {
    const list = JSON.parse(safeStorage.get(LEFT_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberLeftGame(gameId: string): void {
  safeStorage.set(LEFT_KEY, JSON.stringify([...new Set([gameId, ...leftGames()])].slice(0, 20)));
}

export function forgetLeftGame(gameId: string): void {
  safeStorage.set(LEFT_KEY, JSON.stringify(leftGames().filter((id) => id !== gameId)));
}
