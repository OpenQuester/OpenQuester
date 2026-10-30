import { gameScreenStyles } from "./gameScreenStyles";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PanelId } from "@/features/settings/settingsStore";
import { Dialog } from "@/ui/Dialog";
import { ChatBody } from "../ChatPanel";
import { HostTools } from "../HostTools";
import { SpectatorsBody } from "../PlayersPanel";
import { GameSidePanel } from "../GameSidePanel";
import { PANEL_ORDER, type GameScreenModel } from "./useGameScreen";

/** The same panel bodies dock on desktop and open as sheets below 1024px. */
export function GamePanels({ game }: { game: GameScreenModel }) {
  const { t } = useTranslation();
  const { wide, focusPlayer, setPanel, docked, pins, togglePin, allowed, isOpen } = game;
  const titles: Record<PanelId, string> = {
    host: t("menu.host"),
    players: `${t("lobby.spectators")} · ${game.spectatorCount}`,
    chat: t("chat.title"),
  };
  const body = (id: PanelId): ReactNode =>
    id === "host" ? (
      <HostTools
        focusPlayer={focusPlayer}
        // On phones the tools are a sheet over the board: get it out of the way.
        onBoardEdit={wide ? undefined : () => setPanel("host", false)}
      />
    ) : id === "players" ? (
      <SpectatorsBody />
    ) : (
      <ChatBody />
    );

  return (
    <>
      {docked.length > 0 && (
        <aside className={gameScreenStyles.panels} data-testid="side-panels">
          {docked.map((id) => (
            <GameSidePanel
              key={id}
              id={id}
              title={titles[id]}
              pinned={Boolean(pins[id])}
              onPin={() => togglePin(id)}
              onClose={() => setPanel(id, false)}
              className={id === "chat" ? "flex-[1.2_1_0]" : "flex-[1_1_0]"}
            >
              {body(id)}
            </GameSidePanel>
          ))}
        </aside>
      )}
      {!wide &&
        PANEL_ORDER.filter(allowed).map((id) => (
          <Dialog
            key={id}
            open={isOpen(id)}
            onOpenChange={(open) => setPanel(id, open)}
            title={titles[id]}
            side="right"
            closeLabel={t("common.close")}
          >
            {body(id)}
          </Dialog>
        ))}
    </>
  );
}
