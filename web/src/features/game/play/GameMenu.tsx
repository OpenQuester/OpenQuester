import { gameMenuStyles } from "./menu/gameMenuStyles";
import { useTranslation } from "react-i18next";

import { GamePreferences } from "./menu/GamePreferences";
import { ShortcutGuide } from "./menu/ShortcutGuide";
import { useSettings } from "@/features/settings/settingsStore";
import { myRole, phaseOf } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

import { useLiveGame, useSession } from "../GameContext";

export function GameMenu({
  open,
  onOpenChange,
  onHostTools,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the showman tools panel. */
  onHostTools: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useLiveGame();
  const settings = useSettings();
  const role = myRole(session, myId);
  const phase = phaseOf(session);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("menu.title")}
      closeLabel={t("common.close")}
    >
      <div className="flex flex-col gap-6 p-5">
        {role === "showman" && (
          <Button
            variant="accent"
            onClick={() => {
              onOpenChange(false);
              onHostTools();
            }}
          >
            {t("menu.host")}
          </Button>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <ShortcutGuide />
          <GamePreferences settings={settings} />
        </div>
        <div className={gameMenuStyles.actions}>
          {role === "player" && phase !== "finished" && (
            <Button
              onClick={() => {
                connection.setJoinRole("spectator");
                connection.emit("player-role-change", { playerId: myId, newRole: "spectator" });
                onOpenChange(false);
              }}
            >
              {t("menu.spectate")}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="danger" onClick={() => connection.leave()} data-testid="leave-game">
            {t("menu.leave")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
