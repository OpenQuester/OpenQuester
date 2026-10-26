import { useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  const [chosen, setChosen] = useState<JoinOptions | null>(intent ?? null);
  const joinError = useGameStore((s) => (s.gameId === gameId ? s.joinError : null));
  const myListing = useMemo(
    () =>
      me.data && preview.data ? preview.data.players.find((p) => p.id === me.data!.id) : undefined,
    [me.data, preview.data],
  );
  const join: JoinOptions | null =
    chosen ??
    (myListing && !preview.data?.finishedAt
      ? { role: myListing.role, targetSlot: myListing.slot ?? null }
      : null);
  function beginJoin(options: JoinOptions) {
    useGameStore.getState().setJoinError(null);
    setChosen(options);
  }
  return { gameId, me, preview, join, joinError, beginJoin };
}
