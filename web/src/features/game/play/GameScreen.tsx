import { cn } from "@/lib/cn";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { myRole, phaseOf, seatedPlayers } from "@/game/selectors";
import { Button } from "@/ui/Button";
import { ChatIcon, EyeIcon, MenuIcon, PauseIcon, PlayIcon, UsersIcon } from "@/ui/icons";

import { useGame, useSession } from "../GameContext";
import { ChatDrawer } from "./ChatDrawer";
import { ConnectionBanner } from "./ConnectionBanner";
import { Dock } from "./Dock";
import { GameMenu } from "./GameMenu";
import { PlayerChips } from "./PlayerChips";
import { PlayersPanel } from "./PlayersPanel";
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
  const [playersOpen, setPlayersOpen] = useState(false);
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
      ? "bg-accent text-on-accent"
      : role === "player"
        ? "bg-primary text-on-primary"
        : "bg-surface-3 text-text border border-line-strong";
  const roundLabel =
    phase === "finished"
      ? t("game.over")
      : round?.type === "final"
        ? t("game.finalRound")
        : round
          ? t("game.roundLabel", { n: round.order + 1, name: round.name })
          : "";

  return (
    <div className="flex min-h-dvh flex-col bg-bg" data-phase={phase} data-role={role}>
      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>
      <ConnectionBanner showPause />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold",
              roleTone,
            )}
            aria-label={t("game.youAre", { role: t(`roles.${role}`) })}
          >
            {role === "spectator" && <EyeIcon size={16} />}
            <span className="font-medium opacity-80">{t("game.you")}</span>
            <span data-testid="my-role">{t(`roles.${role}`)}</span>
          </span>
          <span
            className="mr-1 max-w-[26ch] truncate text-sm text-muted"
            title={round?.name}
            data-testid="round-name"
          >
            {roundLabel}
          </span>
          <div className="order-last w-full">
            <PlayerChips />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPlayersOpen(true)}
              icon={<UsersIcon size={16} />}
              aria-label={t("players.title")}
              data-testid="open-players"
            >
              <span className="hidden sm:inline">{t("players.button")}</span>
            </Button>
            {role === "showman" && (
              <Button
                size="sm"
                variant="ghost"
                className="border-accent-line text-accent-strong"
                onClick={() => setMenuOpen(true)}
                data-testid="host-tools"
                aria-label={t("menu.host")}
              >
                <span className="sm:hidden">{t("menu.hostShort")}</span>
                <span className="hidden sm:inline">{t("menu.host")}</span>
              </Button>
            )}
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
      <GameMenu open={menuOpen} onOpenChange={setMenuOpen} onPlayers={() => setPlayersOpen(true)} />
      <PlayersPanel open={playersOpen} onOpenChange={setPlayersOpen} />
      {seatedPlayers(session).length === 0 && role === "showman" && phase === "choosing" && (
        <span className="sr-only">{t("game.noPlayers")}</span>
      )}
    </div>
  );
}
