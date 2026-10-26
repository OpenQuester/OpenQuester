import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMe } from "@/features/auth/useMe";
import type { JoinOptions } from "@/game/connection";
import { useGameStore } from "@/game/store";
import { takeJoinIntent } from "./joinIntent";
import { useGamePreview } from "./useGamePreview";

/** Keeps explicit join choices and one-shot invitations separate from automatic rejoin. */
export function useGameEntry() {
  const { gameId: rawId } = useParams({ from: "/games/$gameId" });
  const gameId = rawId.toUpperCase();
  const me = useMe();
  const preview = useGamePreview(gameId);
  const [intent] = useState(() => takeJoinIntent(gameId));
  const [chosen, setChosen] = useState<JoinOptions | null>(null);
  const joinError = useGameStore((s) => (s.gameId === gameId ? s.joinError : null));
  const joined = useGameStore((s) => s.gameId === gameId && s.session !== null);
  useEffect(
    () => () => {
      // Keep failures during retries, but let the next visit rejoin automatically.
      const store = useGameStore.getState();
      if (store.gameId === gameId) store.setJoinError(null);
    },
    [gameId],
  );
  const myListing = useMemo(
    () =>
      me.data && preview.data ? preview.data.players.find((p) => p.id === me.data!.id) : undefined,
    [me.data, preview.data],
  );
  const join: JoinOptions | null =
    chosen ??
    intent ??
    (myListing && !preview.data?.finishedAt
      ? { role: myListing.role, targetSlot: myListing.slot ?? null }
      : null);
  function beginJoin(options: JoinOptions) {
    useGameStore.getState().begin(gameId);
    setChosen(options);
  }
  const joining = !!(chosen && me.data && !joinError && !joined);
  return { gameId, me, preview, join, joinError, joining, beginJoin };
}
