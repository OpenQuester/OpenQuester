import { create, type StateCreator } from "zustand";
import { createStore } from "zustand/vanilla";

import { safeStorage } from "@/lib/storage";

import { reduce, sessionFromSnapshot, type GameSession } from "./reducer";
import type { ServerEvent } from "./protocol";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"
  /** This account opened the game somewhere else, which took over the seat. */
  | "replaced";

export interface GameToast {
  id: number;
  kind: "error" | "info" | "success";
  text: string;
}

export interface GameStore {
  gameId: string | null;
  session: GameSession | null;
  connection: ConnectionStatus;
  /** Set when the server refused the join (wrong password, full game, banned...). */
  joinError: string | null;
  /** Client action waiting for the server; drives the "waiting_for_server" state. */
  pending: { action: string; at: number; playerId?: number } | null;
  toasts: GameToast[];
  /** Set once the local player left or was removed; the page navigates away. */
  left: { gameId: string; why: "left" | "kicked" | "deleted" | "closed" } | null;
  /** Showman: board clicks remove or restore questions instead of picking. */
  boardEdit: boolean;
  setBoardEdit: (on: boolean) => void;
  secretTarget: { scope: string; id: number | null };
  setSecretTarget: (scope: string, id: number | null) => void;
  pointSelections: { scope: string; byPlayer: Record<number, { x: number; y: number }> };
  setPointSelection: (scope: string, playerId: number, spot: { x: number; y: number }) => void;
  previewVolume: number;
  setPreviewVolume: (volume: number) => void;

  begin: (gameId: string) => void;
  dispatch: (event: ServerEvent) => void;
  setConnection: (status: ConnectionStatus) => void;
  setJoinError: (message: string | null) => void;
  setPending: (action: string | null, playerId?: number) => void;
  toast: (kind: GameToast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  markLeft: (why: "left" | "kicked" | "deleted" | "closed") => void;
}

const gameStore = (live: boolean): StateCreator<GameStore> => {
  let toastId = 0;
  return (set, get) => ({
    gameId: null,
    session: null,
    connection: "idle",
    joinError: null,
    pending: null,
    toasts: [],
    left: null,
    boardEdit: false,
    setBoardEdit: (boardEdit) => set({ boardEdit }),
    secretTarget: { scope: "", id: null },
    setSecretTarget: (scope, id) => set({ secretTarget: { scope, id } }),
    pointSelections: { scope: "", byPlayer: {} },
    setPointSelection: (scope, playerId, spot) =>
      set((s) => ({
        pointSelections: {
          scope,
          byPlayer: {
            ...(s.pointSelections.scope === scope ? s.pointSelections.byPlayer : {}),
            [playerId]: spot,
          },
        },
      })),
    previewVolume: 0.7,
    setPreviewVolume: (previewVolume) => set({ previewVolume }),

    begin: (gameId) =>
      set({
        gameId,
        pointSelections: { scope: "", byPlayer: {} },
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
          ...(shouldClearPointSelections(session, event)
            ? { pointSelections: { scope: "", byPlayer: {} } }
            : {}),
          session: sessionFromSnapshot(gameId ?? "", event.payload),
          joinError: null,
          pending: null,
        });
        return;
      }
      if (!session) return;
      const next = reduce(session, event);
      if (next === session) return;
      const { pending } = get();
      set({
        ...(shouldClearPointSelections(session, event)
          ? { pointSelections: { scope: "", byPlayer: {} } }
          : {}),
        session: next,
        pending: resolvesPending(pending, event, session, next) ? null : pending,
      });
    },

    setConnection: (connection) => set({ connection }),
    setJoinError: (joinError) => set({ joinError }),
    setPending: (action, playerId) =>
      set((s) => ({
        ...(!action &&
        ["all-play-answer", "final-answer-submit", "answer-submitted"].includes(
          s.pending?.action ?? "",
        )
          ? { pointSelections: { scope: "", byPlayer: {} } }
          : {}),
        pending: action
          ? { action, at: Date.now(), ...(playerId == null ? {} : { playerId }) }
          : null,
      })),

    toast: (kind, text) => {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
      if (live) window.setTimeout(() => get().dismissToast(id), 4500);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    markLeft: (why) => {
      const gameId = get().gameId;
      if (!gameId) return;
      set({ left: { gameId, why } });
      if (live && why === "left") rememberLeftGame(gameId);
    },
  });
};

/** Keep a repeated question event, but clear on snapshots and new attempts. */
export function shouldClearPointSelections(
  session: GameSession | null,
  event: ServerEvent,
): boolean {
  if (!session) return true;
  const previous = session.state;
  if (event.type === "game-data") return true;
  if (
    event.type === "all-play-start" ||
    event.type === "secret-question-picked" ||
    event.type === "stake-question-picked"
  )
    return true;
  if (event.type === "question-data")
    return (
      previous.currentQuestion?.id !== event.payload.data.id ||
      previous.questionState == null ||
      previous.questionState === "choosing"
    );
  if (event.type === "final-question-data")
    return (
      previous.finalRoundData?.questionData?.question.id !== event.payload.questionData.question.id
    );
  return false;
}

export const useGameStore = create<GameStore>(gameStore(true));
export const createGameStore = () => createStore<GameStore>(gameStore(false));

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

/**
 * Whether this event answers the command still waiting for the server: the
 * server echoed it (same event name), or the game moved to another phase.
 * Chat, readiness and other unrelated updates leave the command waiting, so
 * its waiting state and duplicate-click guard stay until its own result or an
 * error arrives.
 */
function resolvesPending(
  pending: GameStore["pending"],
  event: ServerEvent,
  before: GameSession,
  after: GameSession,
): boolean {
  if (!pending) return false;
  if (event.type === pending.action) {
    if (
      (event.type === "all-play-answer" || event.type === "final-answer-submit") &&
      pending.playerId != null
    )
      return event.payload.playerId === pending.playerId;
    return true;
  }
  return (
    before.state.questionState !== after.state.questionState ||
    before.state.currentRound?.id !== after.state.currentRound?.id ||
    before.state.isPaused !== after.state.isPaused
  );
}
