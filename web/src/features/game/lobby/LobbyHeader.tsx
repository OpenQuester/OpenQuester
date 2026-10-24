import { lobbyStyles } from "./lobbyStyles";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";
import { BackIcon, ChatIcon } from "@/ui/icons";
import type { LobbyModel } from "./useLobby";
export function LobbyHeader({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { connection, setChatOpen, session, role } = lobby;
  return (
    <header className="border-b border-line">
      <div className={lobbyStyles.header}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => connection.leave()}
          icon={<BackIcon size={18} />}
        >
          {t("lobby.leave")}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChatOpen(true)}
          icon={<ChatIcon size={18} />}
        >
          {t("chat.title")}
          {session.chat.length > 0 && (
            <span className="font-mono text-muted">{session.chat.length}</span>
          )}
        </Button>
        <span className={lobbyStyles.codeBadge}>
          {t("lobby.youAre")} <strong className="text-accent">{t(`roles.${role}`)}</strong>
        </span>
      </div>
    </header>
  );
}
