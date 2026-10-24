import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, unwrap } from "@/api/client";
import { useGameStore } from "@/game/store";
import { Button } from "@/ui/Button";

import { useGame } from "./GameContext";

/** Showman only: deletes the game for everyone, after a second confirming click. */
export function DeleteGameButton({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await unwrap(api.DELETE("/v1/games/{gameId}", { params: { path: { gameId } } }));
      useGameStore.getState().markLeft("deleted");
      connection.close();
    } catch (err) {
      useGameStore.getState().toast("error", err instanceof Error ? err.message : String(err));
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)} data-testid="delete-game">
        {t("game.delete")}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("game.delete")}>
      <span className="text-sm text-soft">{t("game.deleteConfirm")}</span>
      <Button
        variant="danger"
        disabled={busy}
        onClick={() => void remove()}
        data-testid="delete-game-confirm"
      >
        {t("game.deleteYes")}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        {t("game.deleteNo")}
      </Button>
    </div>
  );
}
