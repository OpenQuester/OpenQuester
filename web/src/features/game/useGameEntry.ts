import { useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMe } from "@/features/auth/useMe";
import type { JoinOptions } from "@/game/connection";
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
  const [autoRejoin, setAutoRejoin] = useState(true);
  const myListing = useMemo(
    () =>
      me.data && preview.data ? preview.data.players.find((p) => p.id === me.data!.id) : undefined,
    [me.data, preview.data],
  );
  const join: JoinOptions | null =
    chosen ??
    (autoRejoin && myListing && !preview.data?.finishedAt
      ? { role: myListing.role, targetSlot: myListing.slot ?? null }
      : null);
  function reset() {
    setChosen(null);
    setAutoRejoin(false);
  }
  return { gameId, me, preview, join, setChosen, reset };
}
