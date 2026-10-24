import { createContext, useContext } from "react";

import type { GameConnection } from "@/game/connection";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

interface GameContextValue {
  connection: GameConnection;
  myId: number;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame outside GameContext");
  return ctx;
}

/** The joined game's session; only rendered once the snapshot arrived. */
export function useSession(): GameSession {
  const session = useGameStore((s) => s.session);
  if (!session) throw new Error("useSession before game-data");
  return session;
}
