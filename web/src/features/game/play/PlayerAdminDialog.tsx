import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Player } from "@/game/protocol";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Label, TextInput } from "@/ui/Field";

import { useGame, useSession } from "../GameContext";

/** Showman tools for one player: fix a score, hand over the turn, remove. */
export function PlayerAdminDialog({ player, onClose }: { player: Player; onClose: () => void }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const session = useSession();
  const [score, setScore] = useState(String(player.score));
  const id = player.meta.id;
  const isTurn = session.state.currentTurnPlayerId === id;

  function onScore(e: FormEvent) {
    e.preventDefault();
    const value = Number(score.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(value)) return;
    connection.emit("score-changed", { playerId: id, newScore: Math.trunc(value) });
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={player.meta.username}
      closeLabel={t("common.close")}
    >
      <div className="flex flex-col gap-5 p-5">
        <form onSubmit={onScore} className="flex flex-col gap-2">
          <Label htmlFor="admin-score">{t("admin.score")}</Label>
          <div className="flex gap-2">
            <TextInput
              id="admin-score"
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="font-mono"
            />
            <Button type="submit" variant="primary">
              {t("admin.setScore")}
            </Button>
          </div>
          <p className="m-0 text-sm text-muted">{t("admin.scoreHelp")}</p>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isTurn}
            onClick={() => {
              connection.emit("turn-player-changed", { newTurnPlayerId: id });
              onClose();
            }}
          >
            {isTurn ? t("admin.isTurn") : t("admin.giveTurn")}
          </Button>
          <Button
            onClick={() => {
              connection.emit("player-role-change", { playerId: id, newRole: "spectator" });
              onClose();
            }}
          >
            {t("admin.toSpectators")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              connection.emit("player-kicked", { playerId: id });
              onClose();
            }}
          >
            {t("admin.kick")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
