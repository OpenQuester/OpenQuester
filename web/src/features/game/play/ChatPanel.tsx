import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { ChatSystemEntry } from "@/game/protocol";
import { findPlayer } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
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
          if (m.system) {
            return (
              <p
                key={m.uuid}
                className="m-0 self-center rounded-full border border-accent-line/50 px-3 py-1 text-center text-sm text-soft [overflow-wrap:anywhere]"
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

type T = (key: string, options?: Record<string, unknown>) => string;

/** A showman action from the log, in the reader's language. */
function logLine(t: T, entry: ChatSystemEntry, fallback: string): string {
  const p = entry.params;
  const player = typeof p.player === "string" && p.player ? p.player : t("chat.someone");
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  switch (entry.action) {
    case "start":
      return t("chat.log.start");
    case "pause":
      return t("chat.log.pause");
    case "unpause":
      return t("chat.log.unpause");
    case "skip-question-force":
      return t("chat.log.reveal");
    case "buzzer-open":
      return t("chat.log.buzzerOpen");
    case "next-round":
      return p.round ? t("chat.log.nextRoundNamed", { round: p.round }) : t("chat.log.nextRound");
    case "question-pick":
      return t("chat.log.pick", { theme: p.theme, price: formatScore(num(p.price)) });
    case "question-remove-restore":
      return t(p.removed ? "chat.log.toggleRemoved" : "chat.log.toggleRestored", {
        theme: p.theme,
        price: formatScore(num(p.price)),
      });
    case "answer-result":
      return t(p.answerType === "correct" ? "chat.log.answerRight" : "chat.log.answerWrong", {
        player,
        points: formatSigned(num(p.points)),
      });
    case "answer-result-undo":
      return t("chat.log.undo", { player, points: formatSigned(num(p.points)) });
    case "game-join-mode-change":
      return t("chat.log.joinMode", { mode: t(`menu.joinModes.${String(p.joinMode)}`) });
    case "player-kick":
      return t("chat.log.kick", { player });
    case "player-restriction":
      return t(
        p.banned
          ? "chat.log.restrictBanned"
          : p.restricted
            ? "chat.log.restrictRestricted"
            : p.muted
              ? "chat.log.restrictMuted"
              : "chat.log.restrictCleared",
        { player },
      );
    case "player-role-change":
      return t("chat.log.role", { player, role: t(`roles.${String(p.role)}`) });
    case "player-score-change":
      return t("chat.log.score", { player, score: formatScore(num(p.score)) });
    case "player-slot-change":
      return t("chat.log.slot", { player, slot: num(p.slot) });
    case "turn-player-change":
      return p.player ? t("chat.log.turn", { player }) : t("chat.log.turnNone");
    case "secret-question-transfer":
      return t("chat.log.secret", { player });
    case "all-play-review":
    case "final-answer-review":
      return t(p.correct ? "chat.log.reviewRight" : "chat.log.reviewWrong", { player });
    case "theme-eliminate":
      return t("chat.log.theme", { theme: p.theme ?? "" });
    default:
      return fallback;
  }
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
