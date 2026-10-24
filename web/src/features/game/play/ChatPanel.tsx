import { gamePanelStyles } from "./gamePanelStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { TextInput } from "@/ui/Field";
import { ChatMessage } from "./chat/ChatMessage";
import { useChat } from "./chat/useChat";

/** Chat messages and the message box; shown in a sheet or a side panel. */
export function ChatBody() {
  const { t } = useTranslation();
  const { session, text, setText, listRef, muted, onSend } = useChat();

  return (
    <div className="flex h-full flex-col" data-testid="chat-panel">
      <div ref={listRef} className={gamePanelStyles.chatMessages} aria-live="polite">
        {session.chat.length === 0 && <p className="m-0 text-muted">{t("chat.empty")}</p>}
        {session.chat.map((message) => (
          <ChatMessage key={message.uuid} message={message} />
        ))}
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
