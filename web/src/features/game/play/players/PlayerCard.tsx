import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Player } from "@/game/protocol";
import { myRole, phaseOf, questionValue } from "@/game/selectors";
import type { GameSession } from "@/game/reducer";
import type { AnswerOutcome } from "@/game/questionFeedback";
import { clampScore, SCORE_ABS_LIMIT } from "@/game/scoreLimits";
import { formatScore, formatSigned } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { useGame, useGameState, useGameStoreApi, useSession } from "../../GameContext";
import { AvatarDialog } from "./AvatarDialog";
import { usePlayerCard } from "./usePlayerCard";
import "./PlayerCard.css";

function scoreStep(session: GameSession) {
  if (session.state.currentQuestion) return questionValue(session);
  return phaseOf(session) === "choosing" ? session.lastQuestionValue : undefined;
}

export function PlayerCard({
  player,
  tag = "",
  hot = false,
  dim = false,
  onManage,
  outcome,
  submitted = false,
}: {
  player: Player;
  tag?: string;
  hot?: boolean;
  dim?: boolean;
  onManage?: (id: number) => void;
  outcome?: AnswerOutcome;
  submitted?: boolean;
}) {
  const { t } = useTranslation();
  const { myId } = useGame();
  const {
    open: cardOpen,
    setOpen: setCardOpen,
    position,
    trigger,
    panel,
    keepOpen,
    leave,
    focusPanel,
  } = usePlayerCard();
  const id = useId();
  const avatarButton = useRef<HTMLButtonElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const own = myId === player.meta.id;
  const host = player.role === "showman";
  const stateLabel = host ? t("roles.showman") : tag || t("roles.player");
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={cn("player-card", {
          "player-card-host": host,
          "player-card-own": own,
          "player-card-hot": hot,
          "player-card-dim": dim,
        })}
        aria-label={playerCardLabel(player, own ? t("common.you") : "", stateLabel)}
        aria-expanded={cardOpen}
        aria-controls={cardOpen ? id : undefined}
        aria-haspopup="dialog"
        data-outcome={outcome}
        data-submitted={submitted || undefined}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") keepOpen();
        }}
        onPointerLeave={leave}
        onFocus={keepOpen}
        onBlur={leave}
        onClick={focusPanel}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            focusPanel();
          }
        }}
      >
        <Avatar
          name={player.meta.username}
          src={player.meta.avatar}
          size={24}
          muted={player.status !== "in-game"}
        />
        <span className="player-card-name">{player.meta.username}</span>
        <span className="player-card-score" data-testid={host ? undefined : "chip-score"}>
          {host ? stateLabel : formatScore(player.score)}
        </span>
        {!host && tag && (
          <>
            <span className="player-card-state" title={tag} aria-hidden="true" />
            <span className="sr-only">{tag}</span>
          </>
        )}
      </button>
      {cardOpen &&
        createPortal(
          <dialog
            ref={panel}
            id={id}
            open
            aria-label={player.meta.username}
            className="player-card-popover"
            style={position}
            data-no-shortcuts
            onPointerEnter={keepOpen}
            onPointerLeave={leave}
            onFocus={keepOpen}
            onBlur={leave}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={avatarButton}
                type="button"
                className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-accent"
                disabled={!player.meta.avatar}
                aria-label={t("players.viewAvatar", { name: player.meta.username })}
                onClick={() => setAvatarOpen(true)}
              >
                <Avatar name={player.meta.username} src={player.meta.avatar} size={56} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="font-semibold [overflow-wrap:anywhere]">
                  {player.meta.username}
                  {own && (
                    <span className="text-sm font-normal text-info-soft"> ({t("common.you")})</span>
                  )}
                </div>
                {!host && (
                  <div className="mt-1 font-mono font-semibold text-accent-strong">
                    {formatScore(player.score)}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted">{stateLabel}</div>
              </div>
            </div>
            <PlayerScoreControls
              player={player}
              onManage={
                onManage
                  ? (playerId) => {
                      setCardOpen(false);
                      onManage(playerId);
                    }
                  : undefined
              }
            />
          </dialog>,
          document.body,
        )}
      {player.meta.avatar && (
        <AvatarDialog
          name={player.meta.username}
          src={player.meta.avatar}
          open={avatarOpen}
          onOpenChange={setAvatarOpen}
          restoreFocus={() => avatarButton.current ?? trigger.current}
        />
      )}
    </>
  );
}

function playerCardLabel(player: Player, ownLabel: string, stateLabel: string) {
  const name = `${player.meta.username}${ownLabel ? ` (${ownLabel})` : ""}`;
  const state =
    player.role === "showman" ? stateLabel : `${formatScore(player.score)}, ${stateLabel}`;
  return `${name}, ${state}`;
}

function PlayerScoreControls({
  player,
  onManage,
}: {
  player: Player;
  onManage?: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { myId, connection } = useGame();
  const session = useSession();
  const store = useGameStoreApi();
  const pending = useGameState((s) => s.pending);
  const connected = useGameState((s) => s.connection === "connected");
  const canManage = myRole(session, myId) === "showman" && player.role === "player";
  const value = scoreStep(session);
  let reason: string | null = null;
  if (!connected || !connection.connected) reason = t("disabled.connection_lost");
  else if (session.finished) reason = t("game.over");
  else if (pending) reason = t("dock.sending");
  else if (!value) reason = t("players.valueUnavailable");
  function adjust(sign: number) {
    const latest = store.getState();
    const current = latest.session;
    if (
      !current ||
      latest.pending ||
      latest.connection !== "connected" ||
      !connection.connected ||
      current.finished ||
      myRole(current, myId) !== "showman"
    )
      return;
    const target = current.players.find((p) => p.meta.id === player.meta.id && p.role === "player");
    const step = scoreStep(current);
    if (target && step && step > 0)
      connection.emit("score-changed", {
        playerId: target.meta.id,
        newScore: clampScore(target.score + sign * step),
      });
  }
  return (
    <>
      {canManage && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line-strong pt-3">
          <span className="text-xs text-muted">
            {t(session.state.currentQuestion ? "players.currentValue" : "players.lastValue")}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[-1, 1].map((sign) => (
              <Button
                key={sign}
                size="sm"
                variant={sign > 0 ? "success" : "danger"}
                disabled={
                  !!reason ||
                  (sign > 0 ? player.score >= SCORE_ABS_LIMIT : player.score <= -SCORE_ABS_LIMIT)
                }
                onClick={() => adjust(sign)}
                data-testid={sign > 0 ? "quick-score-add" : "quick-score-subtract"}
                aria-label={t(sign > 0 ? "players.addScore" : "players.subtractScore", {
                  amount: formatScore(value ?? 0),
                  name: player.meta.username,
                })}
              >
                {value ? formatSigned(sign * value) : sign > 0 ? "+" : "−"}
              </Button>
            ))}
          </div>
          {reason && <span className="text-xs text-muted">{reason}</span>}
          {onManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onManage(player.meta.id);
              }}
            >
              {t("admin.manage", { name: player.meta.username })}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
