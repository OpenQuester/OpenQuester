import { useState, type FormEvent } from "react";
import type { Player } from "@/game/protocol";
import { useGame, useSession } from "../../GameContext";

/** Local score/confirmation state; only server events change the actual player. */
export function usePlayerModeration(player: Player, onDone: () => void) {
  const { connection } = useGame();
  const session = useSession();
  const [score, setScore] = useState(String(player.score));
  const id = player.meta.id;
  const isTurn = session.state.currentTurnPlayerId === id;
  const inputId = `admin-score-${id}`;
  const limits = player.restrictionData;
  const [confirmBan, setConfirmBan] = useState(false);
  const restrict = (change: Partial<Player["restrictionData"]>) =>
    connection.emit("player-restricted", { playerId: id, ...limits, ...change });

  function onScore(e: FormEvent) {
    e.preventDefault();
    const value = Number(score.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(value)) return;
    connection.emit("score-changed", { playerId: id, newScore: Math.trunc(value) });
    onDone();
  }

  function giveTurn() {
    connection.emit("turn-player-changed", { newTurnPlayerId: id });
    onDone();
  }

  function spectate() {
    connection.emit("player-role-change", { playerId: id, newRole: "spectator" });
    onDone();
  }

  function kick() {
    connection.emit("player-kicked", { playerId: id });
    onDone();
  }

  function toggleRestriction() {
    restrict({ restricted: !limits.restricted });
    if (!limits.restricted) onDone();
  }
  function ban() {
    restrict({ banned: true });
    onDone();
  }

  return {
    score,
    setScore,
    isTurn,
    inputId,
    limits,
    confirmBan,
    setConfirmBan,
    restrict,
    onScore,
    giveTurn,
    spectate,
    kick,
    toggleRestriction,
    ban,
  };
}
