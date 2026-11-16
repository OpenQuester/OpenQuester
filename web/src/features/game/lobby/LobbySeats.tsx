import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";

import type { Player } from "@/game/protocol";
import { Avatar } from "@/ui/Avatar";
import { DoorExitIcon, MoveToSpectatorsIcon } from "@/ui/icons";
import { Button } from "@/ui/Button";
import { MAX_GAME_SLOTS, MIN_GAME_SLOTS } from "@/features/create-game/gameSettings";
import type { LobbyModel } from "./useLobby";
export function LobbySeats({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const {
    seated,
    maxPlayers,
    readyCount,
    slots,
    ready,
    myId,
    role,
    takeSlot,
    connection,
    pending,
  } = lobby;
  const resizing = pending?.action === "game-settings-change";
  const removeReason =
    seated.length >= maxPlayers
      ? t("lobby.slotsOccupied")
      : maxPlayers <= MIN_GAME_SLOTS
        ? t("lobby.minSlots", { min: MIN_GAME_SLOTS })
        : null;
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
          {t("lobby.readyCount", { count: readyCount, total: seated.length })}
        </span>
        {role === "showman" && (
          <div className="flex flex-wrap gap-2">
            <span className="group relative">
              <Button
                size="sm"
                variant="ghost"
                aria-describedby={removeReason ? "remove-slot-reason" : undefined}
                inactive={!!removeReason}
                disabled={resizing}
                onClick={() => {
                  if (!removeReason)
                    connection.emit("game-settings-change", { maxPlayers: maxPlayers - 1 });
                }}
              >
                {t("lobby.removeSlot")}
              </Button>
              {removeReason && (
                <span
                  id="remove-slot-reason"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 hidden w-max max-w-48 rounded-sm border border-line bg-surface-3 px-2 py-1 text-xs text-text group-focus-within:block group-hover:block"
                >
                  {removeReason}
                </span>
              )}
            </span>
            <Button
              size="sm"
              disabled={resizing || maxPlayers >= MAX_GAME_SLOTS}
              onClick={() =>
                connection.emit("game-settings-change", { maxPlayers: maxPlayers + 1 })
              }
            >
              {t("lobby.addSlot")}
            </Button>
          </div>
        )}
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
                onClick={() => takeSlot(i)}
                className={lobbyStyles.emptySeat}
                aria-label={t("lobby.takeSlot", { n: i + 1 })}
              >
                <span className={lobbyStyles.emptyAvatar}>+</span>
                <span className="flex flex-col">
                  <span className="font-semibold">{t("lobby.openSlot")}</span>
                  <span className="text-[13px]">{t("lobby.clickToSit")}</span>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
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
  return (
    <li
      className={cn(
        lobbyStyles.seat,
        isMe ? "border-accent-line bg-accent-surface" : "border-line-strong bg-surface-2",
      )}
      data-testid="lobby-player"
    >
      <Avatar name={player.meta.username} src={player.meta.avatar} />
      <div className={layoutStyles.summaryColumn}>
        <span className="truncate font-semibold">
          {player.meta.username}
          {isMe && <span className="font-normal text-muted"> ({t("common.you")})</span>}
        </span>
        <span className={cn("text-[13px]", ready ? "text-success" : "text-warning")}>
          {t(ready ? "lobby.ready" : "lobby.notReady")}
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
            <MoveToSpectatorsIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onKick}
            aria-label={t("lobby.kick", { name: player.meta.username })}
            title={t("lobby.kick", { name: player.meta.username })}
            className={cn(lobbyStyles.slotAction, "text-danger hover:bg-danger-surface")}
          >
            <DoorExitIcon size={16} />
          </button>
        </div>
      )}
    </li>
  );
}
