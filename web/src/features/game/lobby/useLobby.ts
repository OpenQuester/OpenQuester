import { useState } from "react";
import { me as findMe, seatedPlayers, showman } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { useLiveGame, useSession } from "../GameContext";
import { useGamePreview } from "../useGamePreview";
import { getLobbySeats } from "./getLobbySeats";

export function useLobby() {
  const session = useSession();
  const { connection, myId } = useLiveGame();
  const preview = useGamePreview(session.gameId);
  const pending = useGameStore((s) => s.pending);
  const [chatOpen, setChatOpen] = useState(false);
  const me = findMe(session, myId);
  const role = me?.role ?? "spectator";
  const host = showman(session);
  const seated = seatedPlayers(session);
  const maxPlayers = session.maxPlayers ?? preview.data?.maxPlayers ?? Math.max(seated.length, 2);
  const ready = new Set(session.state.readyPlayers ?? []);
  const activeSeated = seated.filter((p) => p.status === "in-game");
  const readyCount = activeSeated.filter((p) => ready.has(p.meta.id)).length;
  const meReady = ready.has(myId);
  const freeSlots = Math.max(0, maxPlayers - seated.length);
  const { slots, hiddenEmpty } = getLobbySeats(seated, maxPlayers);
  const takeSlot = (slot: number) => {
    if (role === "player") connection.emit("player-slot-change", { targetSlot: slot });
    else connection.takeSeat(slot);
  };
  return {
    session,
    connection,
    myId,
    preview,
    pending,
    chatOpen,
    setChatOpen,
    me,
    role,
    host,
    seated,
    maxPlayers,
    ready,
    activeSeated,
    readyCount,
    meReady,
    freeSlots,
    slots,
    hiddenEmpty,
    takeSlot,
  };
}
export type LobbyModel = ReturnType<typeof useLobby>;
