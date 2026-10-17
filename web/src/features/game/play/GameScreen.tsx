import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSettings, type PanelId } from "@/features/settings/settingsStore";
import { ReportQuestionDialog } from "@/features/stats/ReportQuestion";
import { myRole, phaseOf, roundTimeLeft, seatedPlayers } from "@/game/selectors";
import { formatSeconds } from "@/lib/timer";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { ChatIcon, EyeIcon, MenuIcon, PauseIcon, PlayIcon, UsersIcon } from "@/ui/icons";

import { useGame, useSession } from "../GameContext";
import { ChatBody } from "./ChatPanel";
import { ConnectionBanner } from "./ConnectionBanner";
import { Dock } from "./Dock";
import { GameMenu } from "./GameMenu";
import { HostTools } from "./HostTools";
import { PlayerChips } from "./PlayerChips";
import { PlayersBody } from "./PlayersPanel";
import { SidePanel, WIDE_QUERY } from "./SidePanel";
import { Stage } from "./Stage";
import { useGameFeedback } from "./useGameFeedback";
import { useHotkeys } from "./useHotkeys";

/** Top to bottom in the side column. */
const PANEL_ORDER: PanelId[] = ["host", "players", "chat"];

/**
 * The in-game layout: one screen for every phase so changes never feel like
 * page jumps. Header (who and what), stage (the board or the question) and a
 * dock with the timer, the one action you have now and what happens next.
 * Chat, players and showman tools sit in a side column on wide screens (and
 * can be pinned there); on phones and tablets they open as sheets.
 */
export function GameScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const wide = useMediaQuery(WIDE_QUERY);
  const pins = useSettings((st) => st.pins);
  const updateSettings = useSettings((st) => st.update);
  const [opened, setOpened] = useState<Partial<Record<PanelId, boolean>>>({});
  const [focusPlayer, setFocusPlayer] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const role = myRole(session, myId);
  const phase = phaseOf(session);
  const round = session.state.currentRound;

  const allowed = (id: PanelId) => id !== "host" || role === "showman";
  const isOpen = (id: PanelId) => allowed(id) && Boolean(opened[id] || (wide && pins[id]));
  const setPanel = useCallback(
    (id: PanelId, open: boolean) => {
      setOpened((o) => ({ ...o, [id]: open }));
      // Closing a pinned panel unpins it; phones never show pins.
      if (!open && wide && pins[id]) updateSettings({ pins: { ...pins, [id]: false } });
      if (!open && id === "host") setFocusPlayer(null);
    },
    [pins, updateSettings, wide],
  );
  const togglePin = (id: PanelId) => {
    updateSettings({ pins: { ...pins, [id]: !pins[id] } });
    setOpened((o) => ({ ...o, [id]: true }));
  };
  const docked = wide ? PANEL_ORDER.filter(isOpen) : [];

  const chatVisible = isOpen("chat");
  const lastChatId = session.chat.at(-1)?.uuid;
  const [seenChat, setSeenChat] = useState(lastChatId);
  if (chatVisible && seenChat !== lastChatId) setSeenChat(lastChatId);
  const unread = chatVisible
    ? 0
    : session.chat
        .slice(session.chat.findIndex((m) => m.uuid === seenChat) + 1)
        .filter((m) => !m.system).length;

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);
  useHotkeys({ onChat: () => setPanel("chat", true), onMenu: toggleMenu });
  const announcement = useGameFeedback();

  // Escape closes side panels that aren't pinned (sheets close themselves).
  const closeUnpinned = useCallback(() => {
    setOpened((o) => Object.fromEntries(Object.keys(o).map((k) => [k, false])));
  }, []);
  useEffect(() => {
    if (!wide) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("[role=dialog]")) return;
      closeUnpinned();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide, closeUnpinned]);

  const titles: Record<PanelId, string> = {
    host: t("menu.host"),
    players: t("players.title"),
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
      <PlayersBody />
    ) : (
      <ChatBody />
    );

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
    <div className="flex min-h-dvh bg-bg" data-phase={phase} data-role={role}>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="sr-only" aria-live="polite" role="status">
          {announcement}
        </p>
        <ConnectionBanner showPause />
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-[1320px] 3xl:max-w-[1760px] 4xl:max-w-[2240px] flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-6">
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
            <RoundClock />
            <div className="order-last w-full">
              <PlayerChips
                onManage={(id) => {
                  setFocusPlayer(id);
                  setPanel("host", true);
                }}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {role !== "showman" && (
                <Button
                  size="sm"
                  variant={isOpen("players") ? "secondary" : "ghost"}
                  onClick={() => setPanel("players", !isOpen("players"))}
                  icon={<UsersIcon size={16} />}
                  aria-label={t("players.title")}
                  aria-expanded={isOpen("players")}
                  data-testid="open-players"
                >
                  <span className="hidden sm:inline">{t("players.button")}</span>
                </Button>
              )}
              {role === "showman" && (
                <Button
                  size="sm"
                  variant={isOpen("host") ? "secondary" : "ghost"}
                  className="border-accent-line text-accent-strong"
                  onClick={() => setPanel("host", !isOpen("host"))}
                  data-testid="host-tools"
                  aria-label={t("menu.host")}
                  aria-expanded={isOpen("host")}
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
                variant={chatVisible ? "secondary" : "ghost"}
                onClick={() => setPanel("chat", !chatVisible)}
                icon={<ChatIcon size={16} />}
                aria-label={t("chat.title")}
                aria-expanded={chatVisible}
                data-testid="open-chat"
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
            "mx-auto flex w-full max-w-[1320px] 3xl:max-w-[1760px] 4xl:max-w-[2240px] flex-1 flex-col px-3 py-4 transition-opacity sm:px-6 sm:py-6",
            session.state.isPaused && "opacity-40",
          )}
        >
          <Stage />
        </main>

        <Dock />
      </div>
      {docked.length > 0 && (
        <aside
          className="sticky top-0 flex h-dvh w-[clamp(340px,24vw,460px)] shrink-0 flex-col border-l border-line-strong bg-surface"
          data-testid="side-panels"
        >
          {docked.map((id) => (
            <SidePanel
              key={id}
              id={id}
              title={titles[id]}
              pinned={Boolean(pins[id])}
              onPin={() => togglePin(id)}
              onClose={() => setPanel(id, false)}
              className={id === "chat" ? "flex-[1.2_1_0]" : "flex-[1_1_0]"}
            >
              {body(id)}
            </SidePanel>
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
      <ReportQuestionDialog gameId={session.gameId} />
      <GameMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onHostTools={() => setPanel("host", true)}
      />
      {seatedPlayers(session).length === 0 && role === "showman" && phase === "choosing" && (
        <span className="sr-only">{t("game.noPlayers")}</span>
      )}
    </div>
  );
}

/** Time left in a round with a time limit. */
function RoundClock() {
  const { t } = useTranslation();
  const session = useSession();
  const [, setTick] = useState(0);
  const left = roundTimeLeft(session);
  const limited = left != null;
  useEffect(() => {
    if (!limited) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [limited]);
  if (left == null) return null;
  return (
    <span className="text-sm font-semibold text-muted" data-testid="round-clock">
      {left > 0 ? t("game.roundEndsIn", { time: formatSeconds(left) }) : t("game.roundTimeUp")}
    </span>
  );
}
