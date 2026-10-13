import { cn } from "@/lib/cn";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { myRole, phaseOf, seatedPlayers, spectators } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { ChatIcon, MenuIcon, PauseIcon, PlayIcon } from "@/ui/icons";

import { useGame, useSession } from "../GameContext";
import { ChatDrawer } from "./ChatDrawer";
import { ConnectionBanner } from "./ConnectionBanner";
import { Dock } from "./Dock";
import { GameMenu } from "./GameMenu";
import { PlayerChips } from "./PlayerChips";
import { Stage } from "./Stage";
import { useGameFeedback } from "./useGameFeedback";
import { useHotkeys } from "./useHotkeys";

/**
 * The in-game layout: one screen for every phase so changes never feel like
 * page jumps. Header (who and what), stage (the board or the question) and a
 * dock with the timer, the one action you have now and what happens next.
 */
export function GameScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const role = myRole(session, myId);
  const phase = phaseOf(session);
  const round = session.state.currentRound;
  const [seenChat, setSeenChat] = useState(session.chat.length);
  const unread = chatOpen ? 0 : Math.max(0, session.chat.length - seenChat);
  const chatCount = session.chat.length;
  const openChat = useCallback(
    (open: boolean) => {
      setChatOpen(open);
      setSeenChat(chatCount);
    },
    [chatCount],
  );
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  useHotkeys({ onChat: () => openChat(true), onMenu: toggleMenu });
  const announcement = useGameFeedback();

  const roleTone =
    role === "showman"
      ? "bg-accent-surface text-accent-strong"
      : role === "player"
        ? "bg-surface-2 text-info-soft"
        : "bg-surface-2 text-muted";

  return (
    <div className="flex min-h-dvh flex-col bg-bg" data-phase={phase} data-role={role}>
      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>
      <ConnectionBanner showPause />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6">
          <span
            className={cn("rounded-[8px] px-2.5 py-1 text-[13px] font-semibold", roleTone)}
            data-testid="my-role"
          >
            {t(`roles.${role}`)}
          </span>
          <span className="mr-1 max-w-[18ch] truncate text-sm text-muted" title={round?.name}>
            {phase === "finished"
              ? t("game.over")
              : round?.type === "final"
                ? t("game.finalRound")
                : round?.name}
          </span>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <PlayerChips />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted md:inline">
              {t("game.watching", { count: spectators(session).length })}
            </span>
            {role === "showman" && phase !== "finished" && (
              <Button
                size="sm"
                variant={session.state.isPaused ? "accent" : "ghost"}
                onClick={() =>
                  connection.emit(session.state.isPaused ? "game-unpause" : "game-pause")
                }
                icon={session.state.isPaused ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
                aria-label={session.state.isPaused ? t("game.resume") : t("game.pause")}
              >
                <span className="hidden sm:inline">
                  {session.state.isPaused ? t("game.resume") : t("game.pause")}
                </span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openChat(true)}
              icon={<ChatIcon size={16} />}
              aria-label={t("chat.title")}
            >
              <span className="hidden sm:inline">{t("chat.title")}</span>
              {unread > 0 && (
                <span
                  className="rounded-full bg-accent px-1.5 font-mono text-xs text-on-accent"
                  aria-label={t("chat.unread", { count: unread })}
                >
                  {unread}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMenuOpen(true)}
              aria-label={t("menu.title")}
            >
              <MenuIcon size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-3 py-4 transition-opacity sm:px-6 sm:py-6",
          session.state.isPaused && "opacity-40",
        )}
      >
        <Stage />
      </main>

      <Dock />
      <ChatDrawer open={chatOpen} onOpenChange={openChat} />
      <GameMenu open={menuOpen} onOpenChange={setMenuOpen} />
      {seatedPlayers(session).length === 0 && role === "showman" && phase === "choosing" && (
        <span className="sr-only">{t("game.noPlayers")}</span>
      )}
    </div>
  );
}
