import { lobbyStyles } from "./lobbyStyles";
import { gameEntryStyles } from "../gameEntryStyles";
import { useTranslation } from "react-i18next";

import { Badge } from "@/ui/Badge";
import { ChatDrawer } from "../play/ChatPanel";
import { ConnectionBanner } from "../play/ConnectionBanner";
import { LobbyHeader } from "./LobbyHeader";
import { LobbySeats } from "./LobbySeats";
import { LobbyShowman } from "./LobbyShowman";
import { LobbyPackage } from "./LobbyPackage";
import { LobbyActions } from "./LobbyActions";
import { useLobby } from "./useLobby";
import { InviteCard } from "./InviteCard";
export function LobbyScreen() {
  const { t } = useTranslation();
  const lobby = useLobby();
  const { session, preview, chatOpen, setChatOpen } = lobby;
  return (
    <div className="flex flex-col bg-bg">
      <ConnectionBanner />
      <LobbyHeader lobby={lobby} />

      <main className={lobbyStyles.content}>
        <div className={lobbyStyles.mainColumn}>
          <section className="flex flex-col gap-2">
            <Badge tone="warning" className="self-start">
              {t("lobby.waitingPlayers")}
            </Badge>
            <h1 className={gameEntryStyles.title}>{session.title}</h1>
          </section>

          <LobbyShowman lobby={lobby} />
          <LobbySeats lobby={lobby} />
          <InviteCard gameId={session.gameId} password={session.state.password ?? null} />
          <LobbyPackage packageId={preview.data?.package.id} title={preview.data?.package.title} />
        </div>

        <LobbyActions lobby={lobby} />
      </main>
      <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
