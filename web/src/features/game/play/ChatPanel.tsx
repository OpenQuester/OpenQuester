import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { findPlayer } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { TextInput } from "@/ui/Field";

import { useGame, useSession } from "../GameContext";

/** Chat messages and the message box; shown in a sheet or a side panel. */
export function ChatBody() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const muted = findPlayer(session, myId)?.restrictionData.muted ?? false;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [session.chat.length]);

  function onSend(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    connection.sendChat(message.slice(0, 255));
    setText("");
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-panel">
      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-5"
        aria-live="polite"
      >
        {session.chat.length === 0 && <p className="m-0 text-muted">{t("chat.empty")}</p>}
        {session.chat.map((m) => {
          const author = findPlayer(session, m.user);
          const isShowman = author?.role === "showman";
          return (
            <div
              key={m.uuid}
              className={
                m.user === myId
                  ? "flex flex-col gap-1 self-end rounded-md rounded-br-sm bg-accent-surface px-3.5 py-2.5"
                  : "flex flex-col gap-1 self-start rounded-md rounded-bl-sm bg-surface-2 px-3.5 py-2.5"
              }
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
        })}
      </div>
      <form onSubmit={onSend} className="flex gap-2 border-t border-line p-4">
        <label htmlFor="chat-input" className="sr-only">
          {t("chat.message")}
        </label>
        <TextInput
          id="chat-input"
          value={text}
          maxLength={255}
          disabled={muted}
          onChange={(e) => setText(e.target.value)}
          placeholder={muted ? t("chat.muted") : t("chat.placeholder")}
          data-no-shortcuts
        />
        <Button type="submit" variant="primary" disabled={muted || !text.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </div>
  );
}

/** Chat in a sheet, for screens without a side panel column (the lobby). */
export function ChatDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("chat.title")}
      side="right"
      closeLabel={t("common.close")}
    >
      <ChatBody />
    </Dialog>
  );
}
