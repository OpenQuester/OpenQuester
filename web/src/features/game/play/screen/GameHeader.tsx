import { gameScreenStyles, gameWidth } from "./gameScreenStyles";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { roundTimeLeft } from "@/game/selectors";
import { formatSeconds } from "@/lib/timer";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { ChatIcon, EyeIcon, MenuIcon, PauseIcon, PlayIcon, UsersIcon } from "@/ui/icons";
import { useSession } from "../../GameContext";
import { PlayerChips } from "../PlayerChips";
import type { GameScreenModel } from "./useGameScreen";

export function GameHeader({ game }: { game: GameScreenModel }) {
  const { t } = useTranslation();
  const {
    session,
    connection,
    role,
    phase,
    round,
    isOpen,
    setPanel,
    setFocusPlayer,
    chatVisible,
    unread,
    setMenuOpen,
  } = game;
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
    <header className="border-b border-line">
      <div className={cn(gameWidth, gameScreenStyles.header)}>
        <span
          className={cn(gameScreenStyles.phaseBadge, roleTone)}
          aria-label={t("game.youAre", { role: t(`roles.${role}`) })}
        >
          {role === "spectator" && <EyeIcon size={16} />}
          <span className="font-medium opacity-80">{t("game.you")}</span>
          <span data-testid="my-role">{t(`roles.${role}`)}</span>
        </span>
        <span className={gameScreenStyles.roundName} title={round?.name} data-testid="round-name">
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
                className={gameScreenStyles.unreadCount}
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
