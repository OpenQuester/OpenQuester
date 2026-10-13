import { useTranslation } from "react-i18next";

import { Toggle } from "@/features/settings/SettingsPage";
import { useSettings } from "@/features/settings/settingsStore";
import { myRole, phaseOf } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

import { DeleteGameButton } from "../DeleteGameButton";
import { useGame, useSession } from "../GameContext";

const KEYS = [
  ["menu.keys.buzz", "keys.space"],
  ["menu.keys.option", "1 – 4"],
  ["menu.keys.judge", "C / W"],
  ["menu.keys.chat", "T"],
  ["menu.keys.menu", "?"],
] as const;

export function GameMenu({
  open,
  onOpenChange,
  onPlayers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the players panel (scores and, for the showman, player tools). */
  onPlayers: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
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
          <section className="flex flex-col gap-3 rounded-md border border-accent-line bg-accent-surface p-4">
            <h3 className="m-0 text-base font-semibold">{t("menu.host")}</h3>
            {phase !== "finished" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    connection.emit(session.state.isPaused ? "game-unpause" : "game-pause")
                  }
                >
                  {session.state.isPaused ? t("game.resume") : t("game.pause")}
                </Button>
                {(phase === "showing" ||
                  phase === "answering" ||
                  phase === "media" ||
                  phase === "stake_bidding" ||
                  phase === "secret_transfer") && (
                  <Button size="sm" onClick={() => connection.emit("skip-question-force")}>
                    {t("menu.skipQuestion")}
                  </Button>
                )}
                {phase === "reveal" && (
                  <Button size="sm" onClick={() => connection.emit("skip-show-answer")}>
                    {t("menu.skipReveal")}
                  </Button>
                )}
                <Button size="sm" onClick={() => connection.emit("next-round")}>
                  {t("menu.nextRound")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onPlayers();
                  }}
                >
                  {t("menu.managePlayers")}
                </Button>
              </div>
            )}
            <p className="m-0 text-sm text-muted">{t("menu.hostHelp")}</p>
            <DeleteGameButton gameId={session.gameId} />
          </section>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-base font-semibold">{t("menu.shortcuts")}</h3>
            {KEYS.map(([what, key]) => (
              <div key={what} className="flex items-center justify-between gap-3 text-[15px]">
                <span className="min-w-0">{t(what)}</span>
                <kbd className="shrink-0 whitespace-nowrap rounded-sm border border-line-strong bg-surface-2 px-2 py-1">
                  {key.startsWith("keys.") ? t(key) : key}
                </kbd>
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-1">
            <h3 className="m-0 text-base font-semibold">{t("menu.feel")}</h3>
            <Toggle
              label={t("settings.sound")}
              checked={settings.sound}
              onChange={(v) => settings.update({ sound: v })}
            />
            <Toggle
              label={t("settings.reduceMotion")}
              checked={settings.reduceMotion}
              onChange={(v) => settings.update({ reduceMotion: v })}
            />
            <label htmlFor="menu-vol" className="mt-1 text-[15px]">
              {t("settings.volume")}
            </label>
            <input
              id="menu-vol"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={(e) => settings.update({ volume: Number(e.target.value) / 100 })}
              className="accent-[var(--oq-accent)]"
            />
          </section>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
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
