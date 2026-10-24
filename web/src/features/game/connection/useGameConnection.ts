import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { GameConnection, type JoinOptions } from "@/game/connection";
import { useGameStore } from "@/game/store";

/** One connection per mounted game; cleanup retains the seat for a later rejoin. */
export function useGameConnection(gameId: string, myId: number, join: JoinOptions) {
  const navigate = useNavigate();
  const [connection] = useState(() => new GameConnection(gameId, myId, join));
  const session = useGameStore((s) => s.session);
  const joinError = useGameStore((s) => s.joinError);
  const left = useGameStore((s) => s.left);
  const replaced = useGameStore((s) => s.connection === "replaced");
  useEffect(() => {
    connection.connect();
    return () => connection.close();
  }, [connection]);
  useEffect(() => {
    // Only react to leaving *this* game: the store may still hold the previous one.
    if (left?.gameId === gameId) {
      void navigate({ to: "/", search: left.why === "left" ? {} : { notice: left.why } });
    }
  }, [left, gameId, navigate]);
  const value = useMemo(() => ({ connection, myId }), [connection, myId]);
  return { connection, session, joinError, replaced, value };
}
