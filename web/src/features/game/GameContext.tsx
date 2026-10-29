import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";

import type { GameConnection } from "@/game/connection";
import type { GameSession } from "@/game/reducer";
import { useGameStore, type GameStore } from "@/game/store";

export type GameCommands = Pick<GameConnection, "connected" | "emit">;
type LiveGameCommands = GameCommands &
  Pick<GameConnection, "sendChat" | "setJoinRole" | "takeSeat" | "leave" | "close">;

type GameContextValue = { myId: number; protectedFinalThemeId?: number } & (
  | { connection: LiveGameCommands; store?: undefined }
  | { connection: GameCommands; store: StoreApi<GameStore> }
);

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame outside GameContext");
  return ctx;
}

/** Only the connected-game shell renders controls that require a live transport. */
export function useLiveGame(): { myId: number; connection: LiveGameCommands } {
  const game = useGame();
  if (game.store) throw new Error("Live game action outside connected game");
  return game;
}

/** The joined game's session; only rendered once the snapshot arrived. */
export function useSession(): GameSession {
  const session = useGameState((s) => s.session);
  if (!session) throw new Error("useSession before game-data");
  return session;
}

/** A local game can supply its own store while live games keep their existing one. */
export function useGameStoreApi(): StoreApi<GameStore> {
  return useContext(GameContext)?.store ?? useGameStore;
}

export function useGameState<T>(selector: (state: GameStore) => T): T {
  return useStore(useGameStoreApi(), selector);
}
