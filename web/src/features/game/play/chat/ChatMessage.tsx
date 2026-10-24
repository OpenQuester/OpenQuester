import { gamePanelStyles } from "../gamePanelStyles";
import { useTranslation } from "react-i18next";
import type { ChatMessage as ChatEntry } from "@/game/protocol";
import { findPlayer } from "@/game/selectors";
import { useGame, useSession } from "../../GameContext";
import { logLine } from "./logLine";

export function ChatMessage({ message: m }: { message: ChatEntry }) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();

  if (m.system) {
    return (
      <p
        className={gamePanelStyles.systemMessage}
        data-testid="chat-log"
        data-action={m.system.action}
      >
        <span className="font-semibold text-accent-strong">{t("roles.showman")}</span>
        {" · "}
        {logLine(t, m.system, m.message)}
      </p>
    );
  }
  const author = findPlayer(session, m.user);
  const isShowman = author?.role === "showman";
  return (
    <div
      className={m.user === myId ? gamePanelStyles.ownMessage : gamePanelStyles.otherMessage}
      style={{ maxWidth: "88%" }}
      data-testid="chat-message"
    >
      <span
        className={
          isShowman
            ? "text-sm font-semibold text-accent-strong"
            : "text-sm font-semibold text-info-soft"
        }
      >
        {author?.meta.username ?? t("chat.someone")}
        {isShowman ? ` · ${t("roles.showman")}` : ""}
      </span>
      <span className="[overflow-wrap:anywhere]">{m.message}</span>
    </div>
  );
}
