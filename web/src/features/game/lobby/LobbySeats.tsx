import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";

import type { Player } from "@/game/protocol";
import { Avatar } from "@/ui/Avatar";
import { EyeIcon, CloseIcon } from "@/ui/icons";
import type { LobbyModel } from "./useLobby";
export function LobbySeats({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const {
    seated,
    maxPlayers,
    readyCount,
    activeSeated,
    slots,
    ready,
    myId,
    role,
    takeSlot,
    hiddenEmpty,
    connection,
  } = lobby;
  return (
    <section aria-labelledby="players-h" className={cn("flex flex-col gap-4", lobbyStyles.panel)}>
      <div className={layoutStyles.spacedActions}>
        <h2 id="players-h" className="m-0 text-xl font-semibold">
          {t("lobby.players")}
        </h2>
        <span className="font-mono text-muted">
          {seated.length} / {maxPlayers}
        </span>
        <div className="flex-1" />
        <span className="text-sm font-medium text-success" data-testid="ready-count">
          {t("lobby.readyCount", { count: readyCount, total: activeSeated.length })}
        </span>
      </div>
      <ul className={lobbyStyles.seats}>
        {slots.map(({ p, index: i }) =>
          p ? (
            <PlayerSlot
              key={p.meta.id}
              player={p}
              isMe={p.meta.id === myId}
              ready={ready.has(p.meta.id)}
              canManage={role === "showman"}
              onKick={() => connection.emit("player-kicked", { playerId: p.meta.id })}
              onSpectate={() =>
                connection.emit("player-role-change", {
                  playerId: p.meta.id,
                  newRole: "spectator",
                })
              }
            />
          ) : (
            <li key={`empty-${i}`}>
              <button
                type="button"
                disabled={role === "showman"}
                onClick={() => takeSlot(i)}
                className={lobbyStyles.emptySeat}
                aria-label={
                  role === "showman" ? t("lobby.openSlot") : t("lobby.takeSlot", { n: i + 1 })
                }
              >
                <span className={lobbyStyles.emptyAvatar}>+</span>
                <span className="flex flex-col">
                  <span className="font-semibold">{t("lobby.openSlot")}</span>
                  <span className="text-[13px]">
                    {role === "showman" ? t("lobby.waitingForPlayer") : t("lobby.clickToSit")}
                  </span>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {hiddenEmpty > 0 && (
        <p className="m-0 text-sm text-muted">{t("lobby.moreSeats", { count: hiddenEmpty })}</p>
      )}
    </section>
  );
}
function PlayerSlot({
  player,
  isMe,
  ready,
  canManage,
  onKick,
  onSpectate,
}: {
  player: Player;
  isMe: boolean;
  ready: boolean;
  canManage: boolean;
  onKick: () => void;
  onSpectate: () => void;
}) {
  const { t } = useTranslation();
  const offline = player.status === "disconnected";
  return (
    <li
      className={cn(
        lobbyStyles.seat,
        isMe ? "border-accent-line bg-accent-surface" : "border-line-strong bg-surface-2",
      )}
      data-testid="lobby-player"
    >
      <Avatar name={player.meta.username} src={player.meta.avatar} muted={offline} />
      <div className={layoutStyles.summaryColumn}>
        <span className="truncate font-semibold">
          {player.meta.username}
          {isMe && <span className="font-normal text-muted"> ({t("common.you")})</span>}
        </span>
        <span
          className={cn(
            "text-[13px]",
            offline ? "text-danger" : ready ? "text-success" : "text-warning",
          )}
        >
          {offline ? t("lobby.offline") : ready ? t("lobby.ready") : t("lobby.notReady")}
        </span>
      </div>
      {canManage && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onSpectate}
            aria-label={t("lobby.moveToSpectators", { name: player.meta.username })}
            title={t("lobby.moveToSpectators", { name: player.meta.username })}
            className={cn(lobbyStyles.slotAction, "hover:text-text")}
          >
            <EyeIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onKick}
            aria-label={t("lobby.kick", { name: player.meta.username })}
            title={t("lobby.kick", { name: player.meta.username })}
            className={cn(lobbyStyles.slotAction, "hover:text-danger")}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </li>
  );
}
