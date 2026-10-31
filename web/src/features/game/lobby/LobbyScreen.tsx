import { lobbyStyles } from "./lobbyStyles";
import { gameEntryStyles } from "../gameEntryStyles";
import { useTranslation } from "react-i18next";

import { spectators } from "@/game/selectors";
import { ChatDrawer } from "../play/ChatPanel";
import { ConnectionBanner } from "../play/ConnectionBanner";
import { LobbyHeader } from "./LobbyHeader";
import { LobbySeats } from "./LobbySeats";
import { LobbyShowman } from "./LobbyShowman";
import { LobbyPackage } from "./LobbyPackage";
import { LobbyActions } from "./LobbyActions";
import { useLobby } from "./useLobby";
export function LobbyScreen() {
  const { t } = useTranslation();
  const lobby = useLobby();
  const { session, preview, chatOpen, setChatOpen } = lobby;
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <ConnectionBanner />
      <LobbyHeader lobby={lobby} />

      <main className={lobbyStyles.content}>
        <div className={lobbyStyles.mainColumn}>
          <section className="flex flex-col gap-2">
            <p className={lobbyStyles.phase}>{t("lobby.kicker")}</p>
            <h1 className={gameEntryStyles.title}>{session.title}</h1>
            {preview.data && (
              <p className="m-0 text-muted">
                {t("home.package", { title: preview.data.package.title })}
              </p>
            )}
          </section>

          <LobbyShowman lobby={lobby} />
          <LobbySeats lobby={lobby} />
          <LobbyPackage packageId={preview.data?.package.id} />

          <section aria-labelledby="spec-h" className={lobbyStyles.metadata}>
            <h2 id="spec-h" className="m-0 text-base font-semibold text-text">
              {t("lobby.spectators")}
            </h2>
            <span>{t("lobby.watching", { count: spectators(session).length })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("lobby.spectatorsHelp")}</span>
          </section>
        </div>

        <LobbyActions lobby={lobby} />
      </main>
      <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
